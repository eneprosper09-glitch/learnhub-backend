import express from 'express';
import * as c from '../controllers/categoryController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { categoryRules } from '../validators/category.validator.js';

const router = express.Router();

router.get('/', c.getCategories);
router.post('/', protect, authorize('admin'), categoryRules, validate, c.createCategory);
router.put('/:id', protect, authorize('admin'), categoryRules, validate, c.updateCategory);
router.delete('/:id', protect, authorize('admin'), c.deleteCategory);

export default router;