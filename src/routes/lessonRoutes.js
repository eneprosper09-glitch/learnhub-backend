import express from 'express';
import { body } from 'express-validator';
import * as c from '../controllers/lessonController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { updateLessonRules, reorderLessonsRules } from '../validators/lesson.validator.js';

const router = express.Router();

router.put(
  '/reorder',
  protect,
  authorize('instructor', 'admin'),
  reorderLessonsRules,
  validate,
  c.reorderLessons
);

router.post(
  '/bulk/delete',
  protect,
  authorize('instructor', 'admin'),
  c.bulkDeleteLessons
);

router.post(
  '/bulk/move',
  protect,
  authorize('instructor', 'admin'),
  c.bulkMoveLessons
);

router.get('/:id/play', c.playLesson);

router.put(
  '/:id',
  protect,
  authorize('instructor', 'admin'),
  updateLessonRules,
  validate,
  c.updateLesson
);

router.delete('/:id', protect, authorize('instructor', 'admin'), c.deleteLesson);

export default router;