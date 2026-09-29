import express from 'express';
import { body } from 'express-validator';
import * as c from '../controllers/bookmarkController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();
router.use(protect);

const rules = [
  body('timestamp').isFloat({ min: 0 }).withMessage('Timestamp must be 0 or more'),
  body('label').optional().isLength({ max: 200 }),
];

router.get('/lesson/:lessonId', c.getBookmarksForLesson);
router.post('/lesson/:lessonId', rules, validate, c.createBookmark);
router.delete('/:id', c.deleteBookmark);

export default router;