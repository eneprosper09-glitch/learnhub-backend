export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Not authorized',
        requestId: req.id,
      });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Forbidden',
        requestId: req.id,
      });
    }
    next();
  };
};