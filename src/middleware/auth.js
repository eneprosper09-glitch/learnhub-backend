import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { env } from '../config/env.js';

export const protect = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        code: 'AUTH_TOKEN_EXPIRED',
        message: 'Not authorized',
        requestId: req.id,
      });
    }
    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(decoded.id);
    if (!user || user.isDeleted || !user.isActive) {
      return res.status(401).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'User not found or inactive',
        requestId: req.id,
      });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      code: 'AUTH_TOKEN_EXPIRED',
      message: 'Invalid or expired token',
      requestId: req.id,
    });
  }
};