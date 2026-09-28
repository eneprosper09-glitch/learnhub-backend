import Category from '../models/Category.js';
import { toSlug } from '../utils/slugify.js';

export const getCategories = async (req, res, next) => {
  try {
    const data = await Category.find().sort('name');
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};

export const createCategory = async (req, res, next) => {
  try {
    const { name } = req.body;
    const slug = toSlug(name);
    const existing = await Category.findOne({ $or: [{ name }, { slug }] });
    if (existing) {
      return res.status(409).json({
        success: false,
        code: 'DUPLICATE_KEY',
        message: 'Category already exists',
        requestId: req.id,
      });
    }
    const data = await Category.create({ name, slug });
    res.status(201).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const updateCategory = async (req, res, next) => {
  try {
    const { name } = req.body;
    const data = await Category.findByIdAndUpdate(
      req.params.id,
      { name, slug: toSlug(name) },
      { new: true, runValidators: true }
    );
    if (!data) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Category not found',
        requestId: req.id,
      });
    }
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

export const deleteCategory = async (req, res, next) => {
  try {
    const data = await Category.findByIdAndDelete(req.params.id);
    if (!data) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Category not found',
        requestId: req.id,
      });
    }
    res.json({ success: true, message: 'Category deleted' });
  } catch (err) {
    next(err);
  }
};