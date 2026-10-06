import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import Conversation from '../models/Conversation.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';

let io = null;

const isInstructorOfCourse = (course, userId) =>
  course && String(course.instructor) === String(userId);

const canAccessConversation = async (conversation, userId, role) => {
  if (role === 'admin') return true;
  if (conversation.type === 'group') {
    const course = await Course.findById(conversation.course);
    if (!course) return false;
    if (isInstructorOfCourse(course, userId)) return true;
    const enrollment = await Enrollment.findOne({
      student: userId,
      course: course._id,
      status: 'active',
    });
    return !!enrollment;
  }
  if (conversation.type === 'direct') {
    return conversation.participants.some((p) => String(p) === String(userId));
  }
  return false;
};

// Deterministic room name for a 1-to-1 call. Both participants compute the
// same string regardless of who initiates.
const directRoomName = (a, b) => {
  const [x, y] = [String(a), String(b)].sort();
  return `direct:${x}:${y}`;
};

export const initSocket = (httpServer, app) => {
  io = new Server(httpServer, {
    cors: {
      origin: true,
      credentials: true,
    },
    path: '/socket.io',
  });

  // Auth middleware. The client sends { token } in the connection handshake.
  io.use((socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) return next(new Error('No token'));
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`🔌 Socket connected: ${socket.id} (user ${socket.userId})`);

    // Personal room for direct events (notifications, incoming calls).
    socket.join(`user:${socket.userId}`);

    // ---------------- Conversations ----------------

    socket.on('conversation:join', async ({ conversationId }, ack) => {
      try {
        const conversation = await Conversation.findById(conversationId);
        if (!conversation) return ack?.({ ok: false, error: 'Not found' });

        const User = (await import('../models/User.js')).default;
        const user = await User.findById(socket.userId);
        const allowed = await canAccessConversation(conversation, socket.userId, user?.role);
        if (!allowed) return ack?.({ ok: false, error: 'Forbidden' });

        socket.join(`conv:${conversationId}`);
        ack?.({ ok: true });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });

    socket.on('conversation:leave', ({ conversationId }) => {
      socket.leave(`conv:${conversationId}`);
    });

    socket.on('conversation:typing', ({ conversationId, isTyping }) => {
      socket.to(`conv:${conversationId}`).emit('conversation:typing', {
        conversationId,
        userId: socket.userId,
        isTyping: !!isTyping,
      });
    });

    // ---------------- Call signaling ----------------
    //
    // These events are pure relays. The actual WebRTC/LiveKit media never
    // touches this server. We just deliver a small notification from the
    // caller to the callee (and back) so the UI can ring, accept, reject,
    // or cancel a call.
    //
    // Client → server:
    //   call:invite  { toUserId, kind: 'audio'|'video' }
    //   call:accept  { toUserId }
    //   call:reject  { toUserId }
    //   call:cancel  { toUserId }
    //
    // Server → target's personal room (user:<id>):
    //   call:incoming  { from: { _id, name, avatarUrl }, kind, roomName }
    //   call:accepted  { by:   { _id, name }, roomName }
    //   call:rejected  { by:   { _id, name } }
    //   call:cancelled { by:   { _id, name } }

    socket.on('call:invite', async ({ toUserId, kind }, ack) => {
      try {
        if (!toUserId || String(toUserId) === String(socket.userId)) {
          return ack?.({ ok: false, error: 'Invalid target' });
        }
        const User = (await import('../models/User.js')).default;
        const me = await User.findById(socket.userId).select('name avatarUrl');
        if (!me) return ack?.({ ok: false, error: 'Caller not found' });

        const roomName = directRoomName(socket.userId, toUserId);

        io.to(`user:${toUserId}`).emit('call:incoming', {
          from: {
            _id: String(socket.userId),
            name: me.name,
            avatarUrl: me.avatarUrl || null,
          },
          kind: kind === 'video' ? 'video' : 'audio',
          roomName,
        });

        ack?.({ ok: true, roomName });
      } catch (err) {
        ack?.({ ok: false, error: err.message });
      }
    });

    socket.on('call:accept', async ({ toUserId }) => {
      try {
        if (!toUserId) return;
        const User = (await import('../models/User.js')).default;
        const me = await User.findById(socket.userId).select('name');
        io.to(`user:${toUserId}`).emit('call:accepted', {
          by: { _id: String(socket.userId), name: me?.name || 'User' },
          roomName: directRoomName(socket.userId, toUserId),
        });
      } catch (err) {
        console.warn('call:accept error', err.message);
      }
    });

    socket.on('call:reject', async ({ toUserId }) => {
      try {
        if (!toUserId) return;
        const User = (await import('../models/User.js')).default;
        const me = await User.findById(socket.userId).select('name');
        io.to(`user:${toUserId}`).emit('call:rejected', {
          by: { _id: String(socket.userId), name: me?.name || 'User' },
          roomName: directRoomName(socket.userId, toUserId),
        });
      } catch (err) {
        console.warn('call:reject error', err.message);
      }
    });

    socket.on('call:cancel', async ({ toUserId }) => {
      try {
        if (!toUserId) return;
        const User = (await import('../models/User.js')).default;
        const me = await User.findById(socket.userId).select('name');
        io.to(`user:${toUserId}`).emit('call:cancelled', {
          by: { _id: String(socket.userId), name: me?.name || 'User' },
          roomName: directRoomName(socket.userId, toUserId),
        });
      } catch (err) {
        console.warn('call:cancel error', err.message);
      }
    });

    socket.on('disconnect', () => {
      console.log(`🔌 Socket disconnected: ${socket.id}`);
    });
  });

  app.set('io', io);

  return io;
};

export const getIO = () => io;