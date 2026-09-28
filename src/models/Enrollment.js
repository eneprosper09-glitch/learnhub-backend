import mongoose from 'mongoose';

const enrollmentSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    progressPercent: { type: Number, default: 0 },
    completedCount: { type: Number, default: 0 },
    totalLessons: { type: Number, default: 0 },
    courseSnapshot: {
      title: String,
      price: Number,
      thumbnailUrl: String,
    },
    paid: { type: Boolean, default: false },
    paidAmount: { type: Number, default: 0 },
    paidAt: { type: Date },
    status: { type: String, enum: ['active', 'unenrolled'], default: 'active' },
    unenrolledAt: { type: Date },
  },
  { timestamps: true }
);

enrollmentSchema.index({ student: 1, course: 1 }, { unique: true });

export default mongoose.model('Enrollment', enrollmentSchema);