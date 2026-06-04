const Notification = require('../models/Notification');

const sendNotification = async ({ recipientType = 'specific', recipientId = null, title, body, metadata = {} }) => {
  try {
    await Notification.create({ recipientType, recipientId, channel: 'inApp', title, body, metadata, sentAt: new Date() });
  } catch (err) {
    console.error('Notification error:', err.message);
  }
};

const notifyOrderPlaced = async (order, customer, salesRep) => {
  await sendNotification({ recipientType: 'specific', recipientId: customer._id, title: 'Order Placed', body: `Order ${order.orderNumber} placed successfully.`, metadata: { orderId: order._id } });
  if (salesRep) {
    await sendNotification({ recipientType: 'specific', recipientId: salesRep._id, title: 'New Order', body: `${customer.name || customer.username} placed order ${order.orderNumber}.`, metadata: { orderId: order._id } });
  }
};

const notifyOrderStatusChanged = async (order, customer, newStatus) => {
  await sendNotification({ recipientType: 'specific', recipientId: customer._id, title: 'Order Status Updated', body: `Order ${order.orderNumber} is now: ${newStatus}.`, metadata: { orderId: order._id } });
};

const notifyNewCustomer = async (salesRep, customer) => {
  if (!salesRep) return;
  await sendNotification({ recipientType: 'specific', recipientId: salesRep._id, title: 'New Customer', body: `${customer.name || customer.username} registered.`, metadata: { customerId: customer._id } });
};

module.exports = { sendNotification, notifyOrderPlaced, notifyOrderStatusChanged, notifyNewCustomer };
