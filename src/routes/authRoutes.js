import express from 'express';
import * as c from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter, registerLimiter, forgotPasswordLimiter } from '../middleware/rateLimit.js';
import {
  registerRules,
  loginRules,
  forgotPasswordRules,
  resetPasswordRules,
} from '../validators/auth.validator.js';

const router = express.Router();

router.post('/register', registerLimiter, registerRules, validate, c.register);
router.post('/login', authLimiter, loginRules, validate, c.login);
router.post('/refresh', c.refresh);
router.post('/logout', c.logout);
router.post('/verify-email', c.verifyEmail);
router.post('/resend-verification', forgotPasswordLimiter, c.resendVerification);
router.post('/forgot-password', forgotPasswordLimiter, forgotPasswordRules, validate, c.forgotPassword);
router.post('/reset-password', resetPasswordRules, validate, c.resetPassword);

router.get('/me', protect, c.getMe);
router.put('/me', protect, c.updateMe);

export default router;