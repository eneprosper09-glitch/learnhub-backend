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

router.use(protect, authorize('instructor', 'admin'), uploadLimiter);

router.post('/thumbnail', upload.single('file'), c.uploadThumbnail);
router.post('/video', upload.single('file'), c.uploadLessonVideo);

export default router;