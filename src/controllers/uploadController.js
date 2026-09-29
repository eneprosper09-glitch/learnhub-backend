import { uploadImage, uploadVideo } from '../services/cloudinary.service.js';

const IMAGE_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const VIDEO_MIMES = ['video/mp4', 'video/webm', 'video/quicktime'];
const IMAGE_MAX = 5 * 1024 * 1024;
const VIDEO_MAX = 500 * 1024 * 1024;

const requireVerified = (req, res) => {
  if (!req.user.isEmailVerified) {
    res.status(403).json({
      success: false,
      code: 'EMAIL_NOT_VERIFIED',
      message: 'Please verify your email before uploading files.',
      requestId: req.id,
    });
    return false;
  }
  return true;
};

export const uploadThumbnail = async (req, res, next) => {
  try {
    if (!requireVerified(req, res)) return;
    if (!req.file) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'No file uploaded',
        requestId: req.id,
      });
    }
    if (!IMAGE_MIMES.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'Only jpg, png, and webp images are allowed',
        requestId: req.id,
      });
    }
    if (req.file.size > IMAGE_MAX) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'Image must be under 5 MB',
        requestId: req.id,
      });
    }

    const result = await uploadImage(req.file.buffer);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const uploadLessonVideo = async (req, res, next) => {
  try {
    if (!requireVerified(req, res)) return;
    if (!req.file) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'No file uploaded',
        requestId: req.id,
      });
    }
    if (!VIDEO_MIMES.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'Only mp4, webm, and mov videos are allowed',
        requestId: req.id,
      });
    }
    if (req.file.size > VIDEO_MAX) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'Video must be under 500 MB',
        requestId: req.id,
      });
    }

    const result = await uploadVideo(req.file.buffer);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

export const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'No file uploaded',
        requestId: req.id,
      });
    }
    if (!IMAGE_MIMES.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'Only jpg, png, and webp images are allowed',
        requestId: req.id,
      });
    }
    if (req.file.size > IMAGE_MAX) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'Avatar must be under 5 MB',
        requestId: req.id,
      });
    }

    const result = await uploadImage(req.file.buffer, 'learnhub/avatars');
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};