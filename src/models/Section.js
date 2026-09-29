import mongoose from 'mongoose';

const sectionSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    order: { type: Number, required: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

sectionSchema.index({ course: 1, order: 1 });
sectionSchema.index({ isDeleted: 1 });

export default mongoose.model('Section', sectionSchema);