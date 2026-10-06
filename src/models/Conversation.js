import mongoose from 'mongoose';

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['group', 'direct'],
      required: true,
    },
    // For group conversations: the course this group belongs to.
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', default: null },
    // For direct conversations: the two participants.
    participants: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    ],
    // Optional display name for group conversations (falls back to course title).
    name: { type: String, trim: true },
    // Last message preview for the inbox list.
    lastMessage: { type: String, trim: true },
    lastMessageAt: { type: Date, default: null },
    lastMessageBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

// Exactly one group per course.
conversationSchema.index({ type: 1, course: 1 }, { unique: true, partialFilterExpression: { type: 'group' } });

// Fast lookup of direct conversations per user.
conversationSchema.index({ type: 1, participants: 1 });

// Sort by recent activity.
conversationSchema.index({ lastMessageAt: -1 });

export default mongoose.model('Conversation', conversationSchema);