import { body } from 'express-validator';

export const createLessonRules = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').optional().isString(),
  body('videoUrl').trim().notEmpty().withMessage('Video URL is required'),
  body('duration').optional().isInt({ min: 0 }).withMessage('Duration must be 0 or more'),
  body('isFree').optional().isBoolean().withMessage('isFree must be a boolean'),
];

export const updateLessonRules = [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('description').optional().isString(),
  body('videoUrl').optional().trim().notEmpty().withMessage('Video URL cannot be empty'),
  body('duration').optional().isInt({ min: 0 }),
  body('isFree').optional().isBoolean(),
];

export const reorderLessonsRules = [
  body('courseId').isMongoId().withMessage('Valid courseId is required'),
  body('order').isArray({ min: 1 }).withMessage('order must be a non-empty array'),
  body('order.*').isMongoId().withMessage('Each order entry must be a lesson id'),
];