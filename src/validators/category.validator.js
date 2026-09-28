import { body } from 'express-validator';

export const categoryRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
];