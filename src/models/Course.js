import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    description: { type: String, trim: true },
    thumbnailUrl: { type: String },
    thumbnailPublicId: { type: String },
    category: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    price: { type: Number, default: 0, min: 0 },
    currency: { type: String, default: 'USD' },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner',
    },
    language: { type: String, default: 'English' },
    isPublished: { type: Boolean, default: false },
    averageRating: { type: Number, default: 0 },
    totalStudents: { type: Number, default: 0 },
    totalLessons: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);


courseSchema.index({ title: 'text', description: 'text' });
courseSchema.index({ isPublished: 1, isDeleted: 1 });
courseSchema.index({ category: 1 });

export default mongoose.model('Course', courseSchema);