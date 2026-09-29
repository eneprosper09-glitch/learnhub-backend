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
    discountPercent: { type: Number, default: 0, min: 0, max: 90 },
    currency: { type: String, default: 'USD' },
    level: {
      type: String,
      enum: ['beginner', 'intermediate', 'advanced'],
      default: 'beginner',
    },
    language: { type: String, default: 'English' },
    isPublished: { type: Boolean, default: false },
    averageRating: { type: Number, default: 0 },
    totalReviews: { type: Number, default: 0 },
    totalStudents: { type: Number, default: 0 },
    totalLessons: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

courseSchema.index({ title: 'text', description: 'text' });
courseSchema.index({ isPublished: 1, isDeleted: 1 });
courseSchema.index({ category: 1 });

courseSchema.virtual('discountedPrice').get(function () {
  if (!this.discountPercent || this.discountPercent <= 0) return this.price;
  const discounted = this.price - (this.price * this.discountPercent) / 100;
  return Math.round(discounted * 100) / 100;
});

courseSchema.virtual('hasDiscount').get(function () {
  return this.discountPercent > 0;
});

courseSchema.set('toJSON', { virtuals: true });
courseSchema.set('toObject', { virtuals: true });

export default mongoose.model('Course', courseSchema);