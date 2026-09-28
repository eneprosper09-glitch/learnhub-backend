import mongoose from 'mongoose';
import User from '../models/User.js';
import Category from '../models/Category.js';
import { toSlug } from '../utils/slugify.js';

const ADMIN_EMAIL = 'admin@learnhub.com';
const ADMIN_PASSWORD = 'Admin123!';
const ADMIN_NAME = 'LearnHub Admin';

const DEFAULT_CATEGORIES = [
  'Programming',
  'Design',
  'Business',
  'Data Science',
  'Marketing',
  'Photography',
];

export const runSeed = async (req, res, next) => {
  try {
    const expected = process.env.SEED_SECRET;
    const provided = req.headers['x-seed-secret'] || req.query.secret;

    if (!expected) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Seed endpoint disabled',
        requestId: req.id,
      });
    }

    if (provided !== expected) {
      return res.status(401).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Invalid seed secret',
        requestId: req.id,
      });
    }

    const results = { admin: null, categories: [] };

    const existingAdmin = await User.findOne({ role: 'admin' });
    if (!existingAdmin) {
      await User.create({
        name: ADMIN_NAME,
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        role: 'admin',
        isEmailVerified: true,
        isInstructorApproved: true,
      });
      results.admin = `created (${ADMIN_EMAIL} / ${ADMIN_PASSWORD})`;
    } else {
      results.admin = `already exists (${existingAdmin.email})`;
    }

    for (const name of DEFAULT_CATEGORIES) {
      const slug = toSlug(name);
      const exists = await Category.findOne({ slug });
      if (!exists) {
        await Category.create({ name, slug });
        results.categories.push(`created: ${name}`);
      } else {
        results.categories.push(`exists: ${name}`);
      }
    }

    res.json({ success: true, data: results });
  } catch (err) {
    next(err);
  }
};