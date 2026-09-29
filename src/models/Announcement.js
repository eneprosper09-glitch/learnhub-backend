import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true, maxlength: 2000 },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

announcementSchema.index({ course: 1, createdAt: -1 });

export default mongoose.model('Announcement', announcementSchema);