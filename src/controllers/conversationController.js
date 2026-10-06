import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import User from '../models/User.js';
import { uploadChatAttachment as uploadChatAttachmentToCloudinary } from '../services/cloudinary.service.js';

const isInstructorOfCourse = (course, userId) =>
  course && String(course.instructor) === String(userId);

const isAdmin = (user) => user && user.role === 'admin';

// Check if the user is allowed in a conversation.
const canAccessConversation = async (conversation, user) => {
  if (isAdmin(user)) return true;

  if (conversation.type === 'group') {
    const course = await Course.findById(conversation.course);
    if (!course) return false;
    if (isInstructorOfCourse(course, user._id)) return true;
    const enrollment = await Enrollment.findOne({
      student: user._id,
      course: course._id,
      status: 'active',
    });
    return !!enrollment;
  }

  if (conversation.type === 'direct') {
    return conversation.participants.some((p) => String(p) === String(user._id));
  }

  return false;
};

// Check whether the user is allowed to send MEDIA (images/docs/audio/video)
// in this conversation.
//
// Rules:
//   - Group chats:        allowed for anyone who can access the conversation.
//   - Direct chats:       allowed only if at least one participant is an
//                         instructor or admin.
//   - Direct student ↔ student: NOT allowed.
//
// Assumes canAccessConversation has already returned true.
const canSendMedia = async (conversation, user) => {
  if (isAdmin(user)) return true;

  if (conversation.type === 'group') return true;

  if (conversation.type === 'direct') {
    // Load all participants' roles. conversation.participants may be raw ids
    // or populated objects depending on the caller — normalise to ids.
    const ids = conversation.participants.map((p) => p._id || p);
    const users = await User.find({ _id: { $in: ids } }).select('role');
    return users.some((u) => u.role === 'instructor' || u.role === 'admin');
  }

  return false;
};

// POST /conversations/direct
// Body: { userId }
export const createOrGetDirect = async (req, res, next) => {
  try {
    const { userId } = req.body;
    if (!userId || String(userId) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'A valid userId is required',
        requestId: req.id,
      });
    }

    const other = await User.findById(userId).select('name email role avatarUrl');
    if (!other) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'User not found',
        requestId: req.id,
      });
    }

    const existing = await Conversation.findOne({
      type: 'direct',
      participants: { $all: [req.user._id, userId] },
    }).populate('participants', 'name email role avatarUrl');

    if (existing) {
      return res.json({ success: true, data: existing });
    }

    const conversation = await Conversation.create({
      type: 'direct',
      participants: [req.user._id, userId],
      name: null,
    });

    await conversation.populate('participants', 'name email role avatarUrl');

    res.status(201).json({ success: true, data: conversation });
  } catch (err) {
    next(err);
  }
};

// GET /conversations
export const getMyConversations = async (req, res, next) => {
  try {
    let conversations = [];

    if (isAdmin(req.user)) {
      conversations = await Conversation.find()
        .populate('participants', 'name email role avatarUrl')
        .populate('course', 'title thumbnailUrl')
        .sort('-lastMessageAt -createdAt');
    } else {
      const direct = await Conversation.find({
        type: 'direct',
        participants: req.user._id,
      })
        .populate('participants', 'name email role avatarUrl')
        .sort('-lastMessageAt -createdAt');

      const taught = await Course.find({ instructor: req.user._id }).select('_id');
      const taughtIds = taught.map((c) => c._id);

      const enrollments = await Enrollment.find({
        student: req.user._id,
        status: 'active',
      }).select('course');
      const enrolledIds = enrollments.map((e) => e.course);

      const groupCourseIds = [...new Set([...taughtIds, ...enrolledIds].map(String))];

      const groups = await Conversation.find({
        type: 'group',
        course: { $in: groupCourseIds },
      })
        .populate('participants', 'name email role avatarUrl')
        .populate('course', 'title thumbnailUrl')
        .sort('-lastMessageAt -createdAt');

      conversations = [...direct, ...groups];
      conversations.sort((a, b) => {
        const aTime = a.lastMessageAt || a.createdAt;
        const bTime = b.lastMessageAt || b.createdAt;
        return new Date(bTime) - new Date(aTime);
      });
    }

    res.json({ success: true, count: conversations.length, data: conversations });
  } catch (err) {
    next(err);
  }
};

// GET /conversations/:id
export const getConversation = async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id)
      .populate('participants', 'name email role avatarUrl')
      .populate('course', 'title thumbnailUrl');

    if (!conversation) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Conversation not found',
        requestId: req.id,
      });
    }

    const allowed = await canAccessConversation(conversation, req.user);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You cannot access this conversation',
        requestId: req.id,
      });
    }

    res.json({ success: true, data: conversation });
  } catch (err) {
    next(err);
  }
};

// GET /conversations/:id/messages?before=<ISO date>&limit=30
export const getMessages = async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Conversation not found',
        requestId: req.id,
      });
    }

    const allowed = await canAccessConversation(conversation, req.user);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You cannot access this conversation',
        requestId: req.id,
      });
    }

    const limit = Math.min(Number(req.query.limit) || 30, 100);
    const query = { conversation: conversation._id, isDeleted: false };
    if (req.query.before) {
      query.createdAt = { $lt: new Date(req.query.before) };
    }

    const messages = await Message.find(query)
      .populate('sender', 'name avatarUrl role')
      .sort('-createdAt')
      .limit(limit);

    const ordered = messages.reverse();

    res.json({ success: true, count: ordered.length, data: ordered });
  } catch (err) {
    next(err);
  }
};

// POST /conversations/:id/messages
// Body: { body?: string, attachments?: Array<AttachmentInput> }
//
// `attachments` is optional. Each entry must be the metadata returned by
// POST /conversations/:id/attachments. Passing attachments is only allowed
// when canSendMedia returns true (group chat, or direct chat involving an
// instructor/admin). A message must contain at least one of `body` or
// `attachments`.
export const sendMessage = async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Conversation not found',
        requestId: req.id,
      });
    }

    const allowed = await canAccessConversation(conversation, req.user);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You cannot post in this conversation',
        requestId: req.id,
      });
    }

    const text = String(req.body.body || '').trim();
    const rawAttachments = Array.isArray(req.body.attachments)
      ? req.body.attachments
      : [];

    if (!text && rawAttachments.length === 0) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'Message must have text or attachments',
        requestId: req.id,
      });
    }

    if (text.length > 2000) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'Message body must be 2000 characters or fewer',
        requestId: req.id,
      });
    }

    // Enforce the media rule server-side. Never trust the frontend.
    if (rawAttachments.length > 0) {
      const mediaAllowed = await canSendMedia(conversation, req.user);
      if (!mediaAllowed) {
        return res.status(403).json({
          success: false,
          code: 'MEDIA_NOT_ALLOWED',
          message: 'Attachments are not allowed in this conversation',
          requestId: req.id,
        });
      }
    }

    // Validate each attachment. The client must have just uploaded it via
    // POST /conversations/:id/attachments and received this shape back.
    const attachments = [];
    for (const a of rawAttachments) {
      if (
        !a ||
        typeof a.url !== 'string' ||
        typeof a.publicId !== 'string' ||
        !['image', 'video', 'audio', 'document'].includes(a.type) ||
        !['image', 'video', 'raw'].includes(a.resourceType) ||
        typeof a.name !== 'string' ||
        typeof a.mime !== 'string' ||
        typeof a.size !== 'number'
      ) {
        return res.status(400).json({
          success: false,
          code: 'VALIDATION_FAILED',
          message: 'One or more attachments are malformed',
          requestId: req.id,
        });
      }
      attachments.push({
        url: a.url,
        publicId: a.publicId,
        type: a.type,
        name: a.name.slice(0, 200),
        size: a.size,
        mime: a.mime,
        resourceType: a.resourceType,
      });
    }

    const message = await Message.create({
      conversation: conversation._id,
      sender: req.user._id,
      body: text,
      attachments,
      readBy: [req.user._id],
    });

    // Update the conversation preview. For an attachment-only message, use a
    // human-readable placeholder rather than an empty string.
    const preview =
      text ||
      (attachments[0]?.type === 'image'
        ? '📷 Photo'
        : attachments[0]?.type === 'video'
        ? '🎥 Video'
        : attachments[0]?.type === 'audio'
        ? '🎤 Audio'
        : '📎 Attachment');

    conversation.lastMessage = preview.slice(0, 200);
    conversation.lastMessageAt = message.createdAt;
    conversation.lastMessageBy = req.user._id;
    await conversation.save();

    await message.populate('sender', 'name avatarUrl role');

    const io = req.app.get('io');
    if (io) {
      io.to(`conv:${conversation._id}`).emit('message:new', {
        conversationId: String(conversation._id),
        message: message.toObject(),
      });
    }

    res.status(201).json({ success: true, data: message });
  } catch (err) {
    next(err);
  }
};

// PUT /conversations/:id/read
export const markConversationRead = async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Conversation not found',
        requestId: req.id,
      });
    }

    const allowed = await canAccessConversation(conversation, req.user);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You cannot access this conversation',
        requestId: req.id,
      });
    }

    await Message.updateMany(
      {
        conversation: conversation._id,
        readBy: { $ne: req.user._id },
      },
      { $addToSet: { readBy: req.user._id } }
    );

    res.json({ success: true, message: 'Marked as read' });
  } catch (err) {
    next(err);
  }
};

// GET /conversations/course/:courseId/group
export const getOrCreateCourseGroup = async (req, res, next) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId).populate('instructor', 'name');
    if (!course || course.isDeleted) {
      return res.status(404).json({
        success: false,
        code: 'COURSE_NOT_FOUND',
        message: 'Course not found',
        requestId: req.id,
      });
    }

    const isInstructor =
      String(course.instructor._id) === String(req.user._id) || isAdmin(req.user);
    let allowed = isInstructor;
    if (!allowed) {
      const enrollment = await Enrollment.findOne({
        student: req.user._id,
        course: course._id,
        status: 'active',
      });
      allowed = !!enrollment;
    }
    if (!allowed) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You are not part of this course',
        requestId: req.id,
      });
    }

    let conversation = await Conversation.findOne({
      type: 'group',
      course: course._id,
    })
      .populate('participants', 'name email role avatarUrl')
      .populate('course', 'title thumbnailUrl');

    if (!conversation && isInstructor) {
      conversation = await Conversation.create({
        type: 'group',
        course: course._id,
        participants: [req.user._id],
        name: course.title,
      });
      await conversation.populate('participants', 'name email role avatarUrl');
      await conversation.populate('course', 'title thumbnailUrl');
    }

    if (!conversation) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'The course group chat is not open yet',
        requestId: req.id,
      });
    }

    if (!conversation.participants.some((p) => String(p._id) === String(req.user._id))) {
      conversation.participants.push(req.user._id);
      await conversation.save();
      await conversation.populate('participants', 'name email role avatarUrl');
    }

    res.json({ success: true, data: conversation });
  } catch (err) {
    next(err);
  }
};

// POST /conversations/:id/attachments
// Multipart form-data with field name "file".
//
// Checks:
//   1. The user can access the conversation.
//   2. The user is allowed to send media in this conversation
//      (group chat, or direct chat involving an instructor/admin).
//   3. A file is present.
//
// The route's multer fileFilter already rejected unsupported mime types and
// oversized files, so by the time we get here the buffer is safe to upload.
//
// Returns the attachment metadata — does NOT create a Message. The client
// then calls POST /conversations/:id/messages with the returned object in
// `attachments`.
export const uploadChatAttachment = async (req, res, next) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Conversation not found',
        requestId: req.id,
      });
    }

    const allowed = await canAccessConversation(conversation, req.user);
    if (!allowed) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You cannot post in this conversation',
        requestId: req.id,
      });
    }

    const mediaAllowed = await canSendMedia(conversation, req.user);
    if (!mediaAllowed) {
      return res.status(403).json({
        success: false,
        code: 'MEDIA_NOT_ALLOWED',
        message: 'Attachments are not allowed in this conversation',
        requestId: req.id,
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'No file uploaded',
        requestId: req.id,
      });
    }

    const meta = await uploadChatAttachmentToCloudinary(req.file.buffer, {
      mimetype: req.file.mimetype,
      originalname: req.file.originalname,
      size: req.file.size,
    });

    res.status(201).json({ success: true, data: meta });
  } catch (err) {
    // Surface Cloudinary / service errors with their status if present.
    if (err && err.status) {
      return res.status(err.status).json({
        success: false,
        code: err.code || 'UPLOAD_FAILED',
        message: err.message,
        requestId: req.id,
      });
    }
    next(err);
  }
};