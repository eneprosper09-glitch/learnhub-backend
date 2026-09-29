import express from 'express';
import { body } from 'express-validator';
import * as c from '../controllers/questionController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();

router.get('/lesson/:lessonId', c.getQuestionsForLesson);

router.post(
  '/lesson/:lessonId',
  protect,
  [
    body('title').trim().notEmpty().withMessage('Title required'),
    body('body').trim().notEmpty().withMessage('Body required'),
  ],
  validate,
  c.createQuestion
);

router.post(
  '/:id/answer',
  protect,
  [body('body').trim().notEmpty().withMessage('Answer body required')],
  validate,
  c.answerQuestion
);

router.put('/:id/resolve', protect, c.resolveQuestion);
router.delete('/:id', protect, c.deleteQuestion);

export default router;