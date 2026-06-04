// Payment gateway — STUBBED. Not active at launch.
// Planned: YooMoney, T-Bank Business, SberPay, CloudPayments

const initiatePayment = async ({ orderId, amount, method, customerEmail }) => {
  console.log('[Payment] STUBBED — Payment initiation called for order:', orderId);
  return {
    success: false,
    message: 'Online payment is coming soon. Please arrange payment offline.',
    paymentUrl: null,
  };
};

const verifyPayment = async ({ paymentId }) => {
  console.log('[Payment] STUBBED — Verify called for:', paymentId);
  return { success: false, message: 'Payment verification not yet active.' };
};

const refund = async ({ paymentId, amount }) => {
  console.log('[Payment] STUBBED — Refund called for:', paymentId);
  return { success: false, message: 'Refund not yet active.' };
};

module.exports = { initiatePayment, verifyPayment, refund };
