import User from '../models/User.js';
import { generateAccessToken } from '../utils/generateAccessToken.js';
import { generateRefreshToken } from '../utils/generateRefreshToken.js';
import { generateToken } from '../utils/generateCode.js';
import { env } from '../config/env.js';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from '../services/email.service.js';
import jwt from 'jsonwebtoken';

const REFRESH_COOKIE = 'refreshToken';
const LOCK_DURATION_MS = 15 * 60 * 1000;
const MAX_FAILED_ATTEMPTS = 5;

const setRefreshCookie = (res, token) => {
  res.cookie(REFRESH_COOKIE, token, {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'strict',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth',
  });
};

const clearRefreshCookie = (res) => {
  res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
};

export const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'Email already exists',
        requestId: req.id,
      });
    }

    const verificationToken = generateToken(32);

    const user = await User.create({
      name,
      email,
      password,
      role: role || 'student',
      isEmailVerified: false,
      emailVerificationToken: verificationToken,
      emailVerificationExpires: new Date(Date.now() + 24 * 60 * 60 * 1000),
      isInstructorApproved: role === 'instructor' ? false : true,
    });

    try {
      await sendVerificationEmail(user.email, user.name, verificationToken);
    } catch (emailErr) {
      console.warn('Failed to send verification email:', emailErr.message);
    }

    res.status(201).json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
      message: 'Account created. Please check your email to verify your account.',
    });
  } catch (err) {
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user || user.isDeleted || !user.isActive) {
      return res.status(401).json({
        success: false,
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Invalid email or password',
        requestId: req.id,
      });
    }

    if (user.lockUntil && user.lockUntil > new Date()) {
      const remainingMs = user.lockUntil.getTime() - Date.now();
      const remainingSec = Math.ceil(remainingMs / 1000);
      return res.status(423).json({
        success: false,
        code: 'AUTH_ACCOUNT_LOCKED',
        message: `Account is locked. Try again in ${Math.ceil(remainingSec / 60)} minute(s).`,
        remainingSeconds: remainingSec,
        requestId: req.id,
      });
    }

    const passwordOk = await user.matchPassword(password);
    if (!passwordOk) {
      user.failedLoginAttempts = (user.failedLoginAttempts || 0) + 1;
      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_DURATION_MS);
        user.failedLoginAttempts = 0;
      }
      await user.save();
      return res.status(401).json({
        success: false,
        code: 'AUTH_INVALID_CREDENTIALS',
        message: 'Invalid email or password',
        requestId: req.id,
      });
    }

    user.failedLoginAttempts = 0;
    user.lockUntil = null;

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshTokens = [...(user.refreshTokens || []), { token: refreshToken }];
    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }
    await user.save();

    setRefreshCookie(res, refreshToken);

    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        isInstructorApproved: user.isInstructorApproved,
      },
      accessToken,
    });
  } catch (err) {
    next(err);
  }
};

export const refresh = async (req, res, next) => {
  try {
    const token = req.cookies[REFRESH_COOKIE];
    if (!token) {
      return res.status(401).json({
        success: false,
        code: 'AUTH_TOKEN_EXPIRED',
        message: 'No refresh token',
        requestId: req.id,
      });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, env.jwtRefreshSecret);
    } catch {
      clearRefreshCookie(res);
      return res.status(401).json({
        success: false,
        code: 'AUTH_TOKEN_EXPIRED',
        message: 'Invalid refresh token',
        requestId: req.id,
      });
    }

    const user = await User.findById(decoded.id);
    if (!user || user.isDeleted || !user.isActive) {
      clearRefreshCookie(res);
      return res.status(401).json({
        success: false,
        code: 'AUTH_TOKEN_EXPIRED',
        message: 'User not found',
        requestId: req.id,
      });
    }

    const tokenExists = user.refreshTokens?.some((t) => t.token === token);
    if (!tokenExists) {
      clearRefreshCookie(res);
      return res.status(401).json({
        success: false,
        code: 'AUTH_TOKEN_EXPIRED',
        message: 'Refresh token revoked',
        requestId: req.id,
      });
    }

    const newAccess = generateAccessToken(user._id);
    const newRefresh = generateRefreshToken(user._id);

    // Atomic update: remove the old token and add the new one in a single op
    await User.updateOne(
      { _id: user._id },
      {
        $pull: { refreshTokens: { token } },
      }
    );
    await User.updateOne(
      { _id: user._id },
      {
        $push: { refreshTokens: { token: newRefresh } },
      }
    );

    setRefreshCookie(res, newRefresh);

    res.json({
      success: true,
      accessToken: newAccess,
    });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req, res, next) => {
  try {
    const token = req.cookies[REFRESH_COOKIE];
    if (token) {
      const user = await User.findOne({ 'refreshTokens.token': token });
      if (user) {
        user.refreshTokens = user.refreshTokens.filter((t) => t.token !== token);
        await user.save();
      }
    }
    clearRefreshCookie(res);
    res.json({ success: true, message: 'Logged out' });
  } catch (err) {
    next(err);
  }
};

export const getMe = async (req, res) => {
  res.json({ success: true, data: req.user });
};

export const updateMe = async (req, res, next) => {
  try {
    const allowed = ['name', 'bio', 'avatarUrl'];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) req.user[field] = req.body[field];
    });
    await req.user.save();
    res.json({ success: true, data: req.user });
  } catch (err) {
    next(err);
  }
};

export const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body;
    if (!token) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'Token required',
        requestId: req.id,
      });
    }

    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'Invalid or expired token',
        requestId: req.id,
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    res.json({ success: true, message: 'Email verified' });
  } catch (err) {
    next(err);
  }
};

export const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user || user.isEmailVerified) {
      return res.json({
        success: true,
        message: 'If the email exists, a verification link has been sent.',
      });
    }

    const token = generateToken(32);
    user.emailVerificationToken = token;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();

    try {
      await sendVerificationEmail(user.email, user.name, token);
    } catch (e) {
      console.warn('Failed to send verification email:', e.message);
    }

    res.json({ success: true, message: 'Verification email sent' });
  } catch (err) {
    next(err);
  }
};

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (user) {
      const token = generateToken(32);
      user.passwordResetToken = token;
      user.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000);
      await user.save();
      try {
        await sendPasswordResetEmail(user.email, user.name, token);
      } catch (e) {
        console.warn('Failed to send reset email:', e.message);
      }
    }
    res.json({
      success: true,
      message: 'If the email exists, a reset link has been sent.',
    });
  } catch (err) {
    next(err);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() },
    }).select('+password');

    if (!user) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'Invalid or expired token',
        requestId: req.id,
      });
    }

    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    user.refreshTokens = [];
    await user.save();

    res.json({ success: true, message: 'Password reset successful' });
  } catch (err) {
    next(err);
  }
};