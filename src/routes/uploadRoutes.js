import express from 'express';
import multer from 'multer';
import * as c from '../controllers/uploadController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { uploadLimiter } from '../middleware/rateLimit.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 },
});

// Avatar can be uploaded by any logged-in user (student, instructor, admin)
router.post('/avatar', protect, uploadLimiter, upload.single('file'), c.uploadAvatar);

// Thumbnails and videos are only for instructors and admins
router.post(
  '/thumbnail',
  protect,
  authorize('instructor', 'admin'),
  uploadLimiter,
  upload.single('file'),
  c.uploadThumbnail
);
router.post(
  '/video',
  protect,
  authorize('instructor', 'admin'),
  uploadLimiter,
  upload.single('file'),
  c.uploadLessonVideo
);

export default router;