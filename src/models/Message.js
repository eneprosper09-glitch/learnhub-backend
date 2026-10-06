import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    // One of: 'image' | 'video' | 'audio' | 'document'
    type: {
      type: String,
      enum: ['image', 'video', 'audio', 'document'],
      required: true,
    },
    name: { type: String, required: true, trim: true },
    size: { type: Number, required: true, min: 0 },
    mime: { type: String, required: true },
    // Cloudinary resource type, needed if we ever want to delete the asset
    resourceType: { type: String, enum: ['image', 'video', 'raw'], required: true },
  },
  { _id: false }
);

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // A message can be text, attachments, or both. body is optional only if
    // attachments are present. Enforced in the controller, not here, because
    // mongoose can't easily express "at least one of two fields".
    body: { type: String, trim: true, maxlength: 2000, default: '' },
    attachments: { type: [attachmentSchema], default: [] },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

messageSchema.index({ conversation: 1, createdAt: -1 });

export default mongoose.model('Message', messageSchema);