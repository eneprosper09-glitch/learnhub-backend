import express from 'express';
import { body } from 'express-validator';
import * as c from '../controllers/noteController.js';
import { protect } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = express.Router();
router.use(protect);

const rules = [body('content').trim().notEmpty().withMessage('Note cannot be empty')];

router.get('/lesson/:lessonId', c.getNotesForLesson);
router.post('/lesson/:lessonId', rules, validate, c.createNote);
router.put('/:id', rules, validate, c.updateNote);
router.delete('/:id', c.deleteNote);

export default router;