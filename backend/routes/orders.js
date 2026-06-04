const router = require('express').Router();
const { body, validationResult } = require('express-validator');
const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');
const LoyaltyWallet = require('../models/LoyaltyWallet');
const Coupon = require('../models/Coupon');
const { verifyToken } = require('../middleware/auth');
const { requireAdmin, requireSalesRep } = require('../middleware/roles');
const { notifyOrderPlaced, notifyOrderStatusChanged, sendNotification } = require('../services/notifications');
const msService = require('../services/moysklad');
const Settings = require('../models/Settings');

// POST /api/orders/sync-moysklad — pull live states from MoySklad for active orders
router.post('/sync-moysklad', verifyToken, async (req, res) => {
  try {
    const query = {
      moyskladOrderId: { $ne: null },
      status: { $nin: ['pending', 'delivered', 'cancelled'] },
    };
    if (req.user.role === 'customer') query.customerId = req.user._id;
    else if (req.user.role === 'salesRep') query.salesRepId = req.user._id;

    const orders = await Order.find(query);
    let updated = 0;

    await Promise.allSettled(
      orders.map(async (order) => {
        try {
          const msOrder = await msService.getOrderById(order.moyskladOrderId);
          const rawName = msOrder.state?.name || '';
          const newStatus = msService.mapMsStateToStatus(rawName);

          const becameDispatched = newStatus === 'dispatched' && order.status !== 'dispatched';

          if (newStatus !== order.status || rawName !== order.moyskladStateName) {
            order.status = newStatus;
            order.moyskladStateName = rawName;
            if (becameDispatched) order.dispatchedAt = new Date();
            await order.save();
            updated++;

            if (becameDispatched) {
              await Promise.all([
                sendNotification({
                  recipientType: 'specific',
                  recipientId: order.salesRepId,
                  title: 'Order Dispatched — Confirm Delivery',
                  body: `Order ${order.orderNumber} has been dispatched from warehouse. Mark it as delivered once the customer receives it.`,
                  metadata: { orderId: order._id },
                }),
                sendNotification({
                  recipientType: 'specific',
                  recipientId: order.customerId,
                  title: 'Order Dispatched',
                  body: `Your order ${order.orderNumber} has been dispatched and is on its way!`,
                  metadata: { orderId: order._id },
                }),
              ]);
            }
          }
        } catch (err) {
          if (err.message.includes('MS API 404')) {
            // Order was deleted from MoySklad — cancel it and notify both parties
            order.status = 'cancelled';
            order.cancelReason = 'Order was deleted from MoySklad';
            order.cancelRequestedAt = new Date();
            await order.save();
            updated++;

            await Promise.all([
              sendNotification({
                recipientType: 'specific',
                recipientId: order.customerId,
                title: 'Order Cancelled',
                body: `Your order ${order.orderNumber} has been cancelled. Please contact your sales manager for details.`,
                metadata: { orderId: order._id },
              }),
              sendNotification({
                recipientType: 'specific',
                recipientId: order.salesRepId,
                title: 'Order Deleted from MoySklad',
                body: `Order ${order.orderNumber} (${order.customerId}) was deleted from MoySklad and has been automatically cancelled.`,
                metadata: { orderId: order._id },
              }),
            ]);
          } else {
            console.error(`MoySklad sync failed for order ${order.orderNumber}:`, err.message);
          }
        }
      })
    );

    // Auto-complete dispatched orders older than 24h
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const autoCompleteQuery = { status: 'dispatched', dispatchedAt: { $lt: cutoff } };
    if (req.user.role === 'customer') autoCompleteQuery.customerId = req.user._id;
    else if (req.user.role === 'salesRep') autoCompleteQuery.salesRepId = req.user._id;

    const toComplete = await Order.find(autoCompleteQuery);
    for (const order of toComplete) {
      order.status = 'delivered';
      await order.save();
      updated++;
      await Promise.all([
        sendNotification({
          recipientType: 'specific',
          recipientId: order.customerId,
          title: 'Order Delivered',
          body: `Your order ${order.orderNumber} has been marked as delivered. Thank you!`,
          metadata: { orderId: order._id },
        }),
        sendNotification({
          recipientType: 'specific',
          recipientId: order.salesRepId,
          title: 'Order Auto-Completed',
          body: `Order ${order.orderNumber} was automatically marked as delivered (24h after dispatch).`,
          metadata: { orderId: order._id },
        }),
      ]);
    }

    res.json({ success: true, updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PATCH /api/orders/:id/tracking — sales rep adds tracking info
router.patch('/:id/tracking', verifyToken, requireSalesRep, async (req, res) => {
  try {
    const { trackingUrl, trackingNumber } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    if (req.user.role === 'salesRep' && String(order.salesRepId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    if (trackingUrl !== undefined) order.trackingUrl = trackingUrl || null;
    if (trackingNumber !== undefined) order.trackingNumber = trackingNumber || null;
    await order.save();

    // Notify customer that tracking is available
    if (trackingUrl || trackingNumber) {
      await sendNotification({
        recipientType: 'specific',
        recipientId: order.customerId,
        title: 'Tracking Info Available',
        body: `Tracking info has been added to your order ${order.orderNumber}.`,
        metadata: { orderId: order._id },
      });
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// GET /api/orders — list orders (role-scoped)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;
    const query = {};

    if (req.user.role === 'customer') query.customerId = req.user._id;
    else if (req.user.role === 'salesRep') query.salesRepId = req.user._id;

    if (status) query.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [orders, total] = await Promise.all([
      Order.find(query)
        .populate('customerId', 'name username companyName')
        .populate('salesRepId', 'name username')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Order.countDocuments(query),
    ]);

    res.json({ success: true, orders, total, page: parseInt(page) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/orders/:id
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id)
      .populate('customerId', 'name username companyName email phone')
      .populate('salesRepId', 'name username');

    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    // Access control
    if (req.user.role === 'customer' && String(order.customerId._id) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }
    if (req.user.role === 'salesRep' && String(order.salesRepId._id) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/orders — customer places order
router.post(
  '/',
  verifyToken,
  [
    body('items').isArray({ min: 1 }).withMessage('Items required'),
    body('items.*.productId').notEmpty(),
    body('items.*.quantity').isInt({ min: 1 }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ success: false, errors: errors.array() });

    if (req.user.role !== 'customer') {
      return res.status(403).json({ success: false, message: 'Only customers can place orders.' });
    }

    try {
      const customer = await User.findById(req.user._id);
      if (!customer.salesRepId) {
        return res.status(400).json({ success: false, message: 'No sales rep assigned.' });
      }

      const { items, notes, couponCode, loyaltyCreditsToUse = 0, phone } = req.body;
      const shippingAddress = (req.body.shippingAddress || customer.address || '').trim();

      // Update customer phone if provided at checkout
      if (phone && phone.trim()) {
        customer.phone = phone.trim();
        await customer.save();
      }

      // Resolve products and prices
      const resolvedItems = [];
      let subtotal = 0;

      for (const item of items) {
        const product = await Product.findById(item.productId);
        if (!product || !product.isActive) {
          return res.status(400).json({ success: false, message: `Product ${item.productId} not found.` });
        }
        if (item.quantity < product.minOrderQty) {
          return res.status(400).json({
            success: false,
            message: `Minimum order for ${product.name.ru} is ${product.minOrderQty}.`,
          });
        }

        let unitPrice = product.basePrice;
        if (customer.priceListId) {
          const plEntry = product.priceLists.find(
            (pl) => String(pl.priceListId) === String(customer.priceListId)
          );
          if (plEntry) unitPrice = plEntry.price;
        }

        const totalPrice = unitPrice * item.quantity;
        subtotal += totalPrice;

        resolvedItems.push({
          productId: product._id,
          moyskladProductId: product.moyskladProductId,
          moyskladHref: product.moyskladHref,
          moyskladType: product.isVariant ? 'variant' : 'product',
          name: product.name.ru || product.name.en,
          quantity: item.quantity,
          unitPrice,
          totalPrice,
          loyaltyPercentage: product.loyaltyPercentage ?? null,
        });
      }

      // Apply coupon
      let discountAmount = 0;
      if (couponCode) {
        const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true });
        if (!coupon || (coupon.expiresAt && coupon.expiresAt < new Date())) {
          return res.status(400).json({ success: false, message: 'Invalid or expired coupon.' });
        }
        if (coupon.assignedTo && String(coupon.assignedTo) !== String(customer._id)) {
          return res.status(400).json({ success: false, message: 'Coupon not applicable.' });
        }
        if (subtotal < coupon.minOrderAmount) {
          return res.status(400).json({
            success: false,
            message: `Minimum order ₽${coupon.minOrderAmount} for this coupon.`,
          });
        }
        if (coupon.maxUsageCount && coupon.usedCount >= coupon.maxUsageCount) {
          return res.status(400).json({ success: false, message: 'Coupon usage limit reached.' });
        }

        discountAmount =
          coupon.discountType === 'percent'
            ? (subtotal * coupon.discountValue) / 100
            : Math.min(coupon.discountValue, subtotal);

        coupon.usedCount += 1;
        coupon.usedBy.push(customer._id);
        await coupon.save();
      }

      // Apply loyalty credits
      let creditsUsed = 0;
      if (loyaltyCreditsToUse > 0) {
        const wallet = await LoyaltyWallet.findOne({ customerId: customer._id });
        const maxCredits = Math.min(loyaltyCreditsToUse, wallet?.balance || 0, subtotal - discountAmount);
        creditsUsed = maxCredits;

        if (wallet && creditsUsed > 0) {
          wallet.balance -= creditsUsed;
          wallet.transactions.push({
            type: 'redeem',
            amount: -creditsUsed,
            description: `Redeemed for order`,
          });
          await wallet.save();
        }
      }

      const totalAmount = Math.max(0, subtotal - discountAmount - creditsUsed);

      // Create order in MongoDB
      const order = await Order.create({
        customerId: customer._id,
        salesRepId: customer.salesRepId,
        items: resolvedItems,
        totalAmount,
        discountAmount,
        loyaltyCreditsUsed: creditsUsed,
        couponCode: couponCode || null,
        shippingAddress,
        notes: notes || '',
        status: 'pending',
      });

      // Award loyalty credits — sum per-product rates or fall back to global setting
      const settings = await Settings.get();
      const globalPct = settings.globalLoyaltyPercentage ?? parseFloat(process.env.LOYALTY_PERCENTAGE || '5');
      const earned = resolvedItems.reduce((sum, item) => {
        const pct = item.loyaltyPercentage != null ? item.loyaltyPercentage : globalPct;
        return sum + (item.totalPrice * pct) / 100;
      }, 0);
      if (earned > 0) {
        await LoyaltyWallet.findOneAndUpdate(
          { customerId: customer._id },
          {
            $inc: { balance: earned },
            $push: { transactions: { type: 'earn', amount: earned, orderId: order._id, description: 'Order reward' } },
          },
          { upsert: true }
        );
      }

      // Send notifications
      const salesRep = await User.findById(customer.salesRepId);
      await notifyOrderPlaced(order, customer, salesRep);

      res.status(201).json({ success: true, order });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: 'Server error: ' + err.message });
    }
  }
);

// PATCH /api/orders/:id/status — Admin/SalesRep updates status
router.patch('/:id/status', verifyToken, requireSalesRep, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'processing', 'dispatched', 'delivered', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    if (req.user.role === 'salesRep' && String(order.salesRepId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }

    order.status = status;
    await order.save();

    const customer = await User.findById(order.customerId);

    // Push to MoySklad when sales rep accepts the order
    if (status === 'confirmed' && !order.moyskladOrderId) {
      msService
        .createMoyskladOrder({ customer, salesRep: req.user, items: order.items, notes: order.notes, shippingAddress: order.shippingAddress })
        .then(async (msOrder) => {
          if (msOrder?.id) {
            await Order.updateOne(
              { _id: order._id },
              { moyskladOrderId: msOrder.id, moyskladOrderName: msOrder.name }
            );
          }
        })
        .catch((err) => console.error('MoySklad order sync error:', err.message));
    }

    await notifyOrderStatusChanged(order, customer, status);

    res.json({ success: true, order });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/orders/:id/cancel-request — Customer requests cancellation
router.post('/:id/cancel-request', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ success: false, message: 'Customers only.' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Not found.' });
    if (String(order.customerId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Forbidden.' });
    }
    if (!['pending', 'confirmed'].includes(order.status)) {
      return res.status(400).json({ success: false, message: 'Cannot cancel at this stage.' });
    }

    order.cancelReason = req.body.reason || '';
    order.cancelRequestedAt = new Date();
    await order.save();

    res.json({ success: true, message: 'Cancellation request submitted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// GET /api/orders/stats/summary — Admin/SalesRep
router.get('/stats/summary', verifyToken, requireSalesRep, async (req, res) => {
  try {
    const query = {};
    if (req.user.role === 'salesRep') query.salesRepId = req.user._id;

    const [total, pending, dispatched, revenue] = await Promise.all([
      Order.countDocuments(query),
      Order.countDocuments({ ...query, status: 'pending' }),
      Order.countDocuments({ ...query, status: 'dispatched' }),
      Order.aggregate([
        { $match: { ...query, status: { $nin: ['cancelled'] } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
    ]);

    res.json({
      success: true,
      stats: { total, pending, dispatched, revenue: revenue[0]?.total || 0 },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
