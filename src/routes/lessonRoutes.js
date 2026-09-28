import express from 'express';
import * as c from '../controllers/lessonController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  updateLessonRules,
  reorderLessonsRules,
} from '../validators/lesson.validator.js';

const router = express.Router();

router.put('/reorder', protect, authorize('instructor', 'admin'), reorderLessonsRules, validate, c.reorderLessons);
router.get('/:id/play', c.playLesson);
router.put('/:id', protect, authorize('instructor', 'admin'), updateLessonRules, validate, c.updateLesson);
router.delete('/:id', protect, authorize('instructor', 'admin'), c.deleteLesson);

export default router;