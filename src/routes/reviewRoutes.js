import express from 'express';
import { body } from 'express-validator';
import * as c from '../controllers/reviewController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

const reviewRules = [
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1 to 5'),
  body('comment').optional().isLength({ max: 1000 }),
];

// Public
router.get('/course/:courseId', c.getCourseReviews);
router.get('/instructor/:instructorId', c.getInstructorReviews);
router.get('/instructor-profile/:instructorId', c.getInstructorProfile);

// Protected
router.get('/course/:courseId/mine', protect, c.getMyReview);
router.post('/course/:courseId', protect, reviewRules, validate, c.upsertReview);
router.delete('/:id', protect, c.deleteReview);

export default router;