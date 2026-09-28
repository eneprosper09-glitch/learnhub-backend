import User from '../models/User.js';
import AdminInvitation from '../models/AdminInvitation.js';
import { generateToken } from '../utils/generateCode.js';
import { sendAdminInvitationEmail } from '../services/email.service.js';

export const inviteAdmin = async (req, res, next) => {
  try {
    const { email } = req.body;

    const existingAdminCount = await User.countDocuments({ role: 'admin', isDeleted: false });
    if (existingAdminCount >= 1 && String(req.user._id) !== String(req.originalAdminId || req.user._id)) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Only the original admin can send invitations',
        requestId: req.id,
      });
    }

    const already = await AdminInvitation.findOne({ email, accepted: false });
    if (already) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'An invitation for this email is already pending',
        requestId: req.id,
      });
    }

    const token = generateToken(32);
    const invitation = await AdminInvitation.create({
      email,
      invitedBy: req.user._id,
      token,
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    try {
      await sendAdminInvitationEmail(email, req.user.name, token);
    } catch (e) {
      console.warn('Failed to send admin invitation:', e.message);
    }

    res.status(201).json({ success: true, data: invitation });
  } catch (err) {
    next(err);
  }
};

export const acceptAdminInvitation = async (req, res, next) => {
  try {
    const { token } = req.body;
    const invitation = await AdminInvitation.findOne({
      token,
      accepted: false,
      expires: { $gt: new Date() },
    });
    if (!invitation) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'Invalid or expired invitation',
        requestId: req.id,
      });
    }
    if (invitation.email !== req.user.email) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'This invitation is for a different email',
        requestId: req.id,
      });
    }

    req.user.role = 'admin';
    req.user.isAdminInvited = true;
    await req.user.save();

    invitation.accepted = true;
    await invitation.save();

    res.json({ success: true, data: req.user });
  } catch (err) {
    next(err);
  }
};

export const getUsers = async (req, res, next) => {
  try {
    const { role, search, page = 1, limit = 20 } = req.query;
    const query = { isDeleted: false };
    if (role) query.role = role;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [data, total] = await Promise.all([
      User.find(query).sort('-createdAt').skip(skip).limit(Number(limit)),
      User.countDocuments(query),
    ]);

    res.json({
      success: true,
      count: data.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / Number(limit)) || 1,
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const changeUserRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    const user = await User.findById(req.params.id);
    if (!user || user.isDeleted) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'User not found',
        requestId: req.id,
      });
    }

    if (role === 'admin' && String(user._id) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Promoting to admin requires an invitation',
        requestId: req.id,
      });
    }

    user.role = role;
    await user.save();

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

export const toggleUserActive = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.isDeleted) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'User not found',
        requestId: req.id,
      });
    }
    if (String(user._id) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'You cannot deactivate your own account',
        requestId: req.id,
      });
    }

    user.isActive = !user.isActive;
    await user.save();

    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

export const approveInstructor = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.isDeleted) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'User not found',
        requestId: req.id,
      });
    }
    if (user.role !== 'instructor') {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'User is not an instructor',
        requestId: req.id,
      });
    }
    user.isInstructorApproved = true;
    await user.save();
    res.json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};