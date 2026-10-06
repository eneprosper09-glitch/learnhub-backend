import { AccessToken } from 'livekit-server-sdk';
import { env } from '../config/env.js';
import Conversation from '../models/Conversation.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import User from '../models/User.js';

const isAdmin = (user) => user && user.role === 'admin';

const directRoomName = (a, b) => {
  const [x, y] = [String(a), String(b)].sort();
  return `direct:${x}:${y}`;
};
const groupRoomName = (courseId) => `group:${String(courseId)}`;

const TOKEN_TTL_SECONDS = 60 * 60;

const requireLivekitConfig = () => {
  if (!env.livekit.url || !env.livekit.apiKey || !env.livekit.apiSecret) {
    const err = new Error('LiveKit is not configured on the server');
    err.status = 503;
    err.code = 'LIVEKIT_NOT_CONFIGURED';
    throw err;
  }
};

const buildToken = async ({ roomName, identity, name, canPublish, metadata }) => {
  requireLivekitConfig();
  const at = new AccessToken(env.livekit.apiKey, env.livekit.apiSecret, {
    identity,
    name,
    ttl: TOKEN_TTL_SECONDS,
    metadata: metadata ? JSON.stringify(metadata) : undefined,
  });

  at.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: !!canPublish,
    canSubscribe: true,
    canPublishData: true,
  });

  const jwt = await at.toJwt();
  return jwt;
};

const shareInstructorRelationship = async (requester, other) => {
  if (isAdmin(requester) || isAdmin(other)) {
    return { allowed: true, reason: 'admin' };
  }

  const otherIsInstructor = other.role === 'instructor';
  const requesterIsInstructor = requester.role === 'instructor';

  if (otherIsInstructor) {
    const otherCourses = await Course.find({
      instructor: other._id,
      isDeleted: { $ne: true },
    }).select('_id');
    const courseIds = otherCourses.map((c) => c._id);
    if (courseIds.length === 0) return { allowed: false, reason: 'no-courses' };
    const enrollment = await Enrollment.findOne({
      student: requester._id,
      course: { $in: courseIds },
      status: 'active',
    });
    if (enrollment) return { allowed: true, reason: 'student->instructor' };
    return { allowed: false, reason: 'not-enrolled' };
  }

  if (requesterIsInstructor) {
    const myCourses = await Course.find({
      instructor: requester._id,
      isDeleted: { $ne: true },
    }).select('_id');
    const courseIds = myCourses.map((c) => c._id);
    if (courseIds.length === 0) return { allowed: false, reason: 'no-courses' };
    const enrollment = await Enrollment.findOne({
      student: other._id,
      course: { $in: courseIds },
      status: 'active',
    });
    if (enrollment) return { allowed: true, reason: 'instructor->student' };
    return { allowed: false, reason: 'not-enrolled' };
  }

  return { allowed: false, reason: 'student-student' };
};

// POST /calls/direct/token
export const getDirectCallToken = async (req, res, next) => {
  try {
    const { userId } = req.body || {};
    if (!userId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'userId is required',
        requestId: req.id,
      });
    }
    if (String(userId) === String(req.user._id)) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'You cannot call yourself',
        requestId: req.id,
      });
    }

    const other = await User.findById(userId).select('name role');
    if (!other) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'User not found',
        requestId: req.id,
      });
    }

    const check = await shareInstructorRelationship(req.user, other);
    if (!check.allowed) {
      return res.status(403).json({
        success: false,
        code: 'CALL_NOT_ALLOWED',
        message:
          check.reason === 'student-student'
            ? 'Student-to-student calls are not allowed'
            : 'You do not share a course with this user',
        reason: check.reason,
        requestId: req.id,
      });
    }

    const roomName = directRoomName(req.user._id, other._id);

    const token = await buildToken({
      roomName,
      identity: String(req.user._id),
      name: req.user.name,
      canPublish: true,
      metadata: {
        kind: 'direct',
        callerId: String(req.user._id),
        calleeId: String(other._id),
        calleeName: other.name,
      },
    });

    res.json({
      success: true,
      data: {
        token,
        url: env.livekit.url,
        roomName,
        other: { _id: other._id, name: other.name, role: other.role },
      },
    });
  } catch (err) {
    if (err && err.status) {
      return res.status(err.status).json({
        success: false,
        code: err.code || 'CALL_ERROR',
        message: err.message,
        requestId: req.id,
      });
    }
    next(err);
  }
};

// In-memory map of active group calls: courseId -> { startedBy, startedAt }
const activeGroupCalls = new Map();

// POST /calls/group/token
export const getGroupCallToken = async (req, res, next) => {
  try {
    const { courseId } = req.body || {};
    if (!courseId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'courseId is required',
        requestId: req.id,
      });
    }

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

    const key = String(course._id);
    const active = activeGroupCalls.get(key);

    if (!isInstructor && !active) {
      return res.status(403).json({
        success: false,
        code: 'CALL_NOT_STARTED',
        message: 'The instructor has not started a group call',
        requestId: req.id,
      });
    }

    // If the instructor is starting and there's no active entry, start one
    // AND broadcast to the course group conversation so students get a banner.
    if (isInstructor && !active) {
      const startedAt = Date.now();
      activeGroupCalls.set(key, {
        startedBy: String(req.user._id),
        startedAt,
      });

      const io = req.app.get('io');
      if (io) {
        // Find the group conversation for this course, emit into it.
        const convo = await Conversation.findOne({
          type: 'group',
          course: course._id,
        }).select('_id');
        if (convo) {
          io.to(`conv:${convo._id}`).emit('group-call:started', {
            courseId: key,
            courseTitle: course.title,
            roomName: groupRoomName(course._id),
            startedBy: {
              _id: String(req.user._id),
              name: req.user.name,
            },
            startedAt,
          });
        }
      }
    }

    const roomName = groupRoomName(course._id);

    const token = await buildToken({
      roomName,
      identity: String(req.user._id),
      name: req.user.name,
      canPublish: true,
      metadata: {
        kind: 'group',
        courseId: String(course._id),
        courseTitle: course.title,
        isInstructor,
      },
    });

    res.json({
      success: true,
      data: {
        token,
        url: env.livekit.url,
        roomName,
        course: { _id: course._id, title: course.title },
        isInstructor,
      },
    });
  } catch (err) {
    if (err && err.status) {
      return res.status(err.status).json({
        success: false,
        code: err.code || 'CALL_ERROR',
        message: err.message,
        requestId: req.id,
      });
    }
    next(err);
  }
};

// POST /calls/group/end
export const endGroupCall = async (req, res, next) => {
  try {
    const { courseId } = req.body || {};
    if (!courseId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'courseId is required',
        requestId: req.id,
      });
    }

    const course = await Course.findById(courseId);
    if (!course || course.isDeleted) {
      return res.status(404).json({
        success: false,
        code: 'COURSE_NOT_FOUND',
        message: 'Course not found',
        requestId: req.id,
      });
    }

    const isInstructor =
      String(course.instructor) === String(req.user._id) || isAdmin(req.user);
    if (!isInstructor) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Only the instructor can end the group call',
        requestId: req.id,
      });
    }

    const key = String(course._id);
    activeGroupCalls.delete(key);

    // Notify the group conversation that the call ended.
    const io = req.app.get('io');
    if (io) {
      const convo = await Conversation.findOne({
        type: 'group',
        course: course._id,
      }).select('_id');
      if (convo) {
        io.to(`conv:${convo._id}`).emit('group-call:ended', {
          courseId: key,
          roomName: groupRoomName(course._id),
          endedBy: {
            _id: String(req.user._id),
            name: req.user.name,
          },
        });
      }
    }

    res.json({ success: true, message: 'Group call ended' });
  } catch (err) {
    next(err);
  }
};

// GET /calls/group/status/:courseId
export const getGroupCallStatus = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const course = await Course.findById(courseId);
    if (!course || course.isDeleted) {
      return res.status(404).json({
        success: false,
        code: 'COURSE_NOT_FOUND',
        message: 'Course not found',
        requestId: req.id,
      });
    }

    const isInstructor =
      String(course.instructor) === String(req.user._id) || isAdmin(req.user);
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

    const active = activeGroupCalls.get(String(course._id));

    res.json({
      success: true,
      data: {
        active: !!active,
        startedBy: active?.startedBy || null,
        startedAt: active?.startedAt || null,
        roomName: active ? groupRoomName(course._id) : null,
      },
    });
  } catch (err) {
    next(err);
  }
};