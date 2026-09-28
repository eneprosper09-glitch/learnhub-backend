import mongoose from 'mongoose';

const lessonSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    videoUrl: { type: String, required: true },
    videoPublicId: { type: String },
    duration: { type: Number, default: 0 },
    order: { type: Number, required: true },
    isFree: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

lessonSchema.index({ course: 1, order: 1 });
lessonSchema.index({ isDeleted: 1 });

export default mongoose.model('Lesson', lessonSchema);