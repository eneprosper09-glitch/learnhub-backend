import { body } from 'express-validator';

export const createCourseRules = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('description').optional().isString(),
  body('category').optional().isMongoId().withMessage('Valid category id required'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be 0 or more'),
  body('level')
    .optional()
    .isIn(['beginner', 'intermediate', 'advanced'])
    .withMessage('Invalid level'),
  body('language').optional().isString(),
];

export const updateCourseRules = [
  body('title').optional().trim().notEmpty().withMessage('Title cannot be empty'),
  body('description').optional().isString(),
  body('category').optional().isMongoId().withMessage('Valid category id required'),
  body('price').optional().isFloat({ min: 0 }).withMessage('Price must be 0 or more'),
  body('level')
    .optional()
    .isIn(['beginner', 'intermediate', 'advanced'])
    .withMessage('Invalid level'),
  body('language').optional().isString(),
];