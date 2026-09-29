import express from 'express';
import { body } from 'express-validator';
import * as c from '../controllers/sectionController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { ownsCourse } from '../middleware/ownership.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

const rules = [body('title').trim().notEmpty().withMessage('Title required')];

// Public list
router.get('/course/:courseId', c.getSectionsByCourse);

// Protected
router.post(
  '/course/:courseId',
  protect,
  authorize('instructor', 'admin'),
  ownsCourse,
  rules,
  validate,
  c.createSection
);

router.put(
  '/:id',
  protect,
  authorize('instructor', 'admin'),
  rules,
  validate,
  c.updateSection
);

router.delete('/:id', protect, authorize('instructor', 'admin'), c.deleteSection);

router.put(
  '/reorder/bulk',
  protect,
  authorize('instructor', 'admin'),
  c.reorderSections
);

export default router;