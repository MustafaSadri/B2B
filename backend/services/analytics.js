const Order = require('../models/Order');
const User = require('../models/User');
const Product = require('../models/Product');

// Revenue trend by period
const getRevenueTrend = async (days = 30) => {
  const from = new Date();
  from.setDate(from.getDate() - days);

  const pipeline = [
    { $match: { createdAt: { $gte: from }, status: { $nin: ['cancelled'] } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        revenue: { $sum: '$totalAmount' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ];

  return Order.aggregate(pipeline);
};

// Top customers by revenue
const getTopCustomers = async (limit = 10, days = 30) => {
  const from = new Date();
  from.setDate(from.getDate() - days);

  const pipeline = [
    { $match: { createdAt: { $gte: from }, status: { $nin: ['cancelled'] } } },
    {
      $group: {
        _id: '$customerId',
        totalRevenue: { $sum: '$totalAmount' },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { totalRevenue: -1 } },
    { $limit: limit },
    {
      $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'customer' },
    },
    { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        totalRevenue: 1,
        orderCount: 1,
        customerName: '$customer.name',
        customerUsername: '$customer.username',
      },
    },
  ];

  return Order.aggregate(pipeline);
};

// Sales Rep performance ranking
const getSalesRepPerformance = async (days = 30) => {
  const from = new Date();
  from.setDate(from.getDate() - days);

  const pipeline = [
    { $match: { createdAt: { $gte: from }, status: { $nin: ['cancelled'] } } },
    {
      $group: {
        _id: '$salesRepId',
        totalRevenue: { $sum: '$totalAmount' },
        orderCount: { $sum: 1 },
        customerSet: { $addToSet: '$customerId' },
      },
    },
    {
      $project: {
        totalRevenue: 1,
        orderCount: 1,
        customerCount: { $size: '$customerSet' },
        avgOrderValue: { $divide: ['$totalRevenue', '$orderCount'] },
      },
    },
    { $sort: { totalRevenue: -1 } },
    {
      $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'rep' },
    },
    { $unwind: { path: '$rep', preserveNullAndEmptyArrays: true } },
    {
      $project: {
        totalRevenue: 1,
        orderCount: 1,
        customerCount: 1,
        avgOrderValue: 1,
        repName: '$rep.name',
        repUsername: '$rep.username',
      },
    },
  ];

  return Order.aggregate(pipeline);
};

// Low stock products (stock < 100)
const getLowStockProducts = async (threshold = 100) => {
  return Product.find({ stock: { $lt: threshold, $gte: 0 }, isActive: true })
    .select('name stock unit sku')
    .sort({ stock: 1 })
    .limit(50);
};

// Business growth summary
const getGrowthSummary = async () => {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [thisMonth, lastMonth, totalCustomers, totalOrders] = await Promise.all([
    Order.aggregate([
      { $match: { createdAt: { $gte: thisMonthStart }, status: { $nin: ['cancelled'] } } },
      { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
    ]),
    Order.aggregate([
      {
        $match: {
          createdAt: { $gte: lastMonthStart, $lt: thisMonthStart },
          status: { $nin: ['cancelled'] },
        },
      },
      { $group: { _id: null, revenue: { $sum: '$totalAmount' }, orders: { $sum: 1 } } },
    ]),
    User.countDocuments({ role: 'customer', isActive: true }),
    Order.countDocuments({ status: { $nin: ['cancelled'] } }),
  ]);

  const thisRev = thisMonth[0]?.revenue || 0;
  const lastRev = lastMonth[0]?.revenue || 0;
  const revenueGrowth = lastRev > 0 ? ((thisRev - lastRev) / lastRev) * 100 : 0;

  return {
    thisMonthRevenue: thisRev,
    lastMonthRevenue: lastRev,
    revenueGrowth: Math.round(revenueGrowth * 10) / 10,
    thisMonthOrders: thisMonth[0]?.orders || 0,
    lastMonthOrders: lastMonth[0]?.orders || 0,
    totalCustomers,
    totalOrders,
  };
};

module.exports = {
  getRevenueTrend,
  getTopCustomers,
  getSalesRepPerformance,
  getLowStockProducts,
  getGrowthSummary,
};
