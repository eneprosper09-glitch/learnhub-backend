import express from 'express';
import { body } from 'express-validator';
import * as c from '../controllers/announcementController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { ownsCourse } from '../middleware/ownership.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

const rules = [
  body('title').trim().notEmpty().withMessage('Title required'),
  body('body').trim().notEmpty().withMessage('Body required'),
];

router.get('/course/:courseId', c.getCourseAnnouncements);

router.post(
  '/course/:courseId',
  protect,
  authorize('instructor', 'admin'),
  ownsCourse,
  rules,
  validate,
  c.createAnnouncement
);

router.delete('/:id', protect, authorize('instructor', 'admin'), c.deleteAnnouncement);

export default router;