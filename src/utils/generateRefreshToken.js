import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpires,
  });
};