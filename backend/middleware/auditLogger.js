const AuditLog = require('../models/AuditLog');

const auditLog = (action, targetType = null) => {
  return async (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = async (data) => {
      if (res.statusCode < 400) {
        try {
          await AuditLog.create({
            actorId: req.user?._id || null,
            actorRole: req.user?.role || 'anonymous',
            action,
            targetType,
            targetId: req.params?.id || data?.data?._id || null,
            metadata: { method: req.method, path: req.path, body: req.body },
            ipAddress: req.ip,
          });
        } catch (e) {
          // Non-blocking
        }
      }
      return originalJson(data);
    };
    next();
  };
};

module.exports = { auditLog };
