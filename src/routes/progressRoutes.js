import express from 'express';
import { markLessonComplete } from '../controllers/enrollmentController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.post('/lessons/:id/complete', markLessonComplete);

export default router;