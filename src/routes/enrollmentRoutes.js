import express from 'express';
import * as c from '../controllers/enrollmentController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/:id/enroll', protect, c.enrollInCourse);
router.put('/:courseId/unenroll', protect, c.unenrollFromCourse);

router.use(protect);
router.get('/me', c.getMyEnrollments);
router.get('/progress/:courseId', c.getMyProgress);

export default router;