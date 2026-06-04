const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }
  next();
};

const requireSalesRep = (req, res, next) => {
  if (!req.user || (req.user.role !== 'salesRep' && req.user.role !== 'admin')) {
    return res.status(403).json({ success: false, message: 'Sales Rep access required.' });
  }
  next();
};

const requireCustomer = (req, res, next) => {
  if (!req.user || req.user.role !== 'customer') {
    return res.status(403).json({ success: false, message: 'Customer access required.' });
  }
  next();
};

const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }
  next();
};

module.exports = { requireAdmin, requireSalesRep, requireCustomer, requireAuth };
