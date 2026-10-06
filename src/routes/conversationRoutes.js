import express from 'express';
import multer from 'multer';
import { body } from 'express-validator';
import * as c from '../controllers/conversationController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { CHAT_MIME_MAP } from '../services/cloudinary.service.js';

const router = express.Router();

// Per-file size limits for chat attachments.
//   - Video: 50 MB
//   - Everything else (image / document / audio): 10 MB
const CHAT_VIDEO_MAX = 50 * 1024 * 1024;
const CHAT_OTHER_MAX = 10 * 1024 * 1024;

// Max files per message. Currently enforced one file per request (single
// upload), but kept as a constant so we can raise it later without hunting.
const CHAT_MAX_FILES = 5;

const chatUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: CHAT_VIDEO_MAX, // hard ceiling — per-type check happens in fileFilter
    files: CHAT_MAX_FILES,
  },
  fileFilter: (req, file, cb) => {
    const mapping = CHAT_MIME_MAP[file.mimetype];
    if (!mapping) {
      const err = new Error(
        `Unsupported file type: ${file.mimetype}. Allowed: images, PDFs, office docs, plain text, audio, and common video formats.`
      );
      err.status = 400;
      err.code = 'UNSUPPORTED_FILE_TYPE';
      return cb(err);
    }
    cb(null, true);
  },
});

// Middleware to enforce the tighter per-type size limit AFTER multer has the
// buffer. multer's global limit is the ceiling; this is the actual rule.
const enforceChatSize = (req, res, next) => {
  if (!req.file) return next();
  const mapping = CHAT_MIME_MAP[req.file.mimetype];
  const limit = mapping?.type === 'video' ? CHAT_VIDEO_MAX : CHAT_OTHER_MAX;
  if (req.file.size > limit) {
    const mb = Math.round(limit / (1024 * 1024));
    return res.status(400).json({
      success: false,
      code: 'VALIDATION_FAILED',
      message:
        mapping?.type === 'video'
          ? `Video must be under ${mb} MB`
          : `File must be under ${mb} MB`,
      requestId: req.id,
    });
  }
  next();
};

router.use(protect);

router.get('/', c.getMyConversations);

router.post(
  '/direct',
  [body('userId').isMongoId().withMessage('Valid user id required')],
  validate,
  c.createOrGetDirect
);

router.get('/course/:courseId/group', c.getOrCreateCourseGroup);

// Upload a single chat attachment. Two-step flow: the client uploads the
// file first, gets metadata back, then posts a message with that metadata
// in `attachments`.
router.post(
  '/:id/attachments',
  uploadLimiter,
  chatUpload.single('file'),
  enforceChatSize,
  c.uploadChatAttachment
);

router.get('/:id', c.getConversation);
router.get('/:id/messages', c.getMessages);

// NOTE: no express-validator `body('body').notEmpty()` here. A message is
// valid if it has text OR attachments — the controller enforces that.
// Adding a notEmpty check would reject attachment-only messages.
router.post('/:id/messages', c.sendMessage);

router.put('/:id/read', c.markConversationRead);

export default router;