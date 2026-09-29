import mongoose from 'mongoose';

const bookmarkSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
    timestamp: { type: Number, required: true, min: 0 },
    label: { type: String, trim: true, maxlength: 200 },
  },
  { timestamps: true }
);

bookmarkSchema.index({ student: 1, lesson: 1 });

export default mongoose.model('Bookmark', bookmarkSchema);