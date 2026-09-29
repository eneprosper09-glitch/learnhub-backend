import Bookmark from '../models/Bookmark.js';
import Lesson from '../models/Lesson.js';
import Enrollment from '../models/Enrollment.js';

export const getBookmarksForLesson = async (req, res, next) => {
  try {
    const lesson = await Lesson.findById(req.params.lessonId);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Lesson not found',
        requestId: req.id,
      });
    }

    const bookmarks = await Bookmark.find({
      student: req.user._id,
      lesson: lesson._id,
    }).sort('timestamp');

    res.json({ success: true, count: bookmarks.length, data: bookmarks });
  } catch (err) {
    next(err);
  }
};

export const createBookmark = async (req, res, next) => {
  try {
    const lesson = await Lesson.findById(req.params.lessonId);
    if (!lesson) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Lesson not found',
        requestId: req.id,
      });
    }

    const enrollment = await Enrollment.findOne({
      student: req.user._id,
      course: lesson.course,
    });
    if (!enrollment && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        code: 'NOT_ENROLLED',
        message: 'Enroll to bookmark',
        requestId: req.id,
      });
    }

    const bookmark = await Bookmark.create({
      student: req.user._id,
      course: lesson.course,
      lesson: lesson._id,
      timestamp: req.body.timestamp,
      label: req.body.label || '',
    });

    res.status(201).json({ success: true, data: bookmark });
  } catch (err) {
    next(err);
  }
};

export const deleteBookmark = async (req, res, next) => {
  try {
    const bookmark = await Bookmark.findById(req.params.id);
    if (!bookmark) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Bookmark not found',
        requestId: req.id,
      });
    }
    if (String(bookmark.student) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You cannot delete this bookmark',
        requestId: req.id,
      });
    }
    await bookmark.deleteOne();
    res.json({ success: true, message: 'Bookmark deleted' });
  } catch (err) {
    next(err);
  }
};