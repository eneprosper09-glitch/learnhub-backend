import mongoose from 'mongoose';
import { connectDB } from './config/db.js';
import User from './models/User.js';
import Category from './models/Category.js';
import { toSlug } from './utils/slugify.js';

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

const run = async () => {
  await connectDB();

  const existingAdmin = await User.findOne({ role: 'admin' });
  if (!existingAdmin) {
    const admin = await User.create({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: 'admin',
      isEmailVerified: true,
      isInstructorApproved: true,
    });
    console.log('Original admin created:');
    console.log(`  Email:    ${ADMIN_EMAIL}`);
    console.log(`  Password: ${ADMIN_PASSWORD}`);
    console.log('  Change this password after first login.');
  } else {
    console.log(`Admin already exists: ${existingAdmin.email}`);
  }

  for (const name of DEFAULT_CATEGORIES) {
    const slug = toSlug(name);
    const exists = await Category.findOne({ slug });
    if (!exists) {
      await Category.create({ name, slug });
      console.log(`Category created: ${name}`);
    }
  }

  await mongoose.disconnect();
  console.log('Seed complete.');
};

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});