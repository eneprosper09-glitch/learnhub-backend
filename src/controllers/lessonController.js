import Lesson from '../models/Lesson.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import Progress from '../models/Progress.js';
import { deleteAsset } from '../services/cloudinary.service.js';

const recalcProgress = async (courseId) => {
  const totalLessons = await Lesson.countDocuments({ course: courseId, isDeleted: false });
  const enrollments = await Enrollment.find({ course: courseId });

  for (const en of enrollments) {
    const completed = await Progress.countDocuments({
      student: en.student,
      course: courseId,
    });
    en.completedCount = completed;
    en.totalLessons = totalLessons;
    en.progressPercent = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;
    await en.save();
  }

  await Course.findByIdAndUpdate(courseId, { totalLessons });
};

export const createLesson = async (req, res, next) => {
  try {
    const course = req.course;
    const { title, description, videoUrl, videoPublicId, duration, isFree } = req.body;

    const last = await Lesson.findOne({ course: course._id, isDeleted: false }).sort('-order');
    const order = last ? last.order + 1 : 1;

    const lesson = await Lesson.create({
      course: course._id,
      title,
      description,
      videoUrl,
      videoPublicId,
      duration: duration || 0,
      order,
      isFree: !!isFree,
    });

    await recalcProgress(course._id);

    res.status(201).json({ success: true, data: lesson });
  } catch (err) {
    next(err);
  }
};

export const updateLesson = async (req, res, next) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson || lesson.isDeleted) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Lesson not found',
        requestId: req.id,
      });
    }

    if (req.user.role !== 'admin') {
      const course = await Course.findById(lesson.course);
      if (!course || String(course.instructor) !== String(req.user._id)) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'You do not own this lesson',
          requestId: req.id,
        });
      }
    }

    if (
      req.body.videoPublicId &&
      lesson.videoPublicId &&
      req.body.videoPublicId !== lesson.videoPublicId
    ) {
      await deleteAsset(lesson.videoPublicId, 'video');
    }

    const allowed = ['title', 'description', 'videoUrl', 'videoPublicId', 'duration', 'isFree'];
    allowed.forEach((f) => {
      if (req.body[f] !== undefined) lesson[f] = req.body[f];
    });
    await lesson.save();

    res.json({ success: true, data: lesson });
  } catch (err) {
    next(err);
  }
};

export const deleteLesson = async (req, res, next) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson || lesson.isDeleted) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Lesson not found',
        requestId: req.id,
      });
    }

    if (req.user.role !== 'admin') {
      const course = await Course.findById(lesson.course);
      if (!course || String(course.instructor) !== String(req.user._id)) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'You do not own this lesson',
          requestId: req.id,
        });
      }
    }

    if (lesson.videoPublicId) {
      await deleteAsset(lesson.videoPublicId, 'video');
    }

    lesson.isDeleted = true;
    await lesson.save();

    const remaining = await Lesson.find({ course: lesson.course, isDeleted: false }).sort('order');
    for (let i = 0; i < remaining.length; i++) {
      remaining[i].order = i + 1;
      await remaining[i].save();
    }

    await recalcProgress(lesson.course);

    res.json({ success: true, message: 'Lesson deleted' });
  } catch (err) {
    next(err);
  }
};

export const reorderLessons = async (req, res, next) => {
  try {
    const { courseId, order } = req.body;

    const course = await Course.findById(courseId);
    if (!course || course.isDeleted) {
      return res.status(404).json({
        success: false,
        code: 'COURSE_NOT_FOUND',
        message: 'Course not found',
        requestId: req.id,
      });
    }

    if (req.user.role !== 'admin' && String(course.instructor) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You do not own this course',
        requestId: req.id,
      });
    }

    for (let i = 0; i < order.length; i++) {
      await Lesson.updateOne({ _id: order[i], course: courseId }, { order: i + 1 });
    }

    res.json({ success: true, message: 'Lessons reordered' });
  } catch (err) {
    next(err);
  }
};

export const playLesson = async (req, res, next) => {
  try {
    const lesson = await Lesson.findById(req.params.id);
    if (!lesson || lesson.isDeleted) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Lesson not found',
        requestId: req.id,
      });
    }

    if (lesson.isFree) {
      return res.json({ success: true, data: { videoUrl: lesson.videoUrl } });
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        code: 'AUTH_TOKEN_EXPIRED',
        message: 'Login required to play this lesson',
        requestId: req.id,
      });
    }

    if (req.user.role === 'admin') {
      return res.json({ success: true, data: { videoUrl: lesson.videoUrl } });
    }

    const course = await Course.findById(lesson.course);
    if (course && String(course.instructor) === String(req.user._id)) {
      return res.json({ success: true, data: { videoUrl: lesson.videoUrl } });
    }

    const enrolled = await Enrollment.findOne({
      student: req.user._id,
      course: lesson.course,
    });
    if (!enrolled) {
      return res.status(403).json({
        success: false,
        code: 'LESSON_LOCKED',
        message: 'Enroll in this course to watch this lesson',
        requestId: req.id,
      });
    }

    res.json({ success: true, data: { videoUrl: lesson.videoUrl } });
  } catch (err) {
    next(err);
  }
};

export const getLessonsByCourse = async (req, res, next) => {
  try {
    const data = await Lesson.find({
      course: req.params.courseId,
      isDeleted: false,
    }).sort('order');
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};