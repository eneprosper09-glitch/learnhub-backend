import mongoose from 'mongoose';

const adminInvitationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    token: { type: String, required: true, unique: true },
    accepted: { type: Boolean, default: false },
    expires: { type: Date, required: true },
  },
  { timestamps: true }
);

adminInvitationSchema.index({ email: 1 });


export default mongoose.model('AdminInvitation', adminInvitationSchema);