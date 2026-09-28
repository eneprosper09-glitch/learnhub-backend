import { body } from 'express-validator';

export const inviteRules = [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
];

export const roleChangeRules = [
  body('role')
    .isIn(['student', 'instructor', 'admin'])
    .withMessage('Invalid role'),
];