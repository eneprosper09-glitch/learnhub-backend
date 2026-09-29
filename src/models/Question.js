import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema(
  {
    lesson: { type: mongoose.Schema.Types.ObjectId, ref: 'Lesson', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    answers: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        body: { type: String, required: true, trim: true, maxlength: 2000 },
        isInstructorAnswer: { type: Boolean, default: false },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    isResolved: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

questionSchema.index({ lesson: 1, createdAt: -1 });
questionSchema.index({ course: 1, createdAt: -1 });

export default mongoose.model('Question', questionSchema);