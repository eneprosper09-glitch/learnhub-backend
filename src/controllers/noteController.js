import Note from '../models/Note.js';
import Lesson from '../models/Lesson.js';
import Enrollment from '../models/Enrollment.js';

const requireEnrollment = async (userId, courseId) => {
  const enrollment = await Enrollment.findOne({ student: userId, course: courseId });
  return !!enrollment;
};

export const getNotesForLesson = async (req, res, next) => {
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

    const enrolled = await requireEnrollment(req.user._id, lesson.course);
    if (!enrolled && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        code: 'NOT_ENROLLED',
        message: 'Enroll to view notes',
        requestId: req.id,
      });
    }

    const notes = await Note.find({
      student: req.user._id,
      lesson: lesson._id,
    }).sort('-createdAt');

    res.json({ success: true, count: notes.length, data: notes });
  } catch (err) {
    next(err);
  }
};

export const createNote = async (req, res, next) => {
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

    const enrolled = await requireEnrollment(req.user._id, lesson.course);
    if (!enrolled && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        code: 'NOT_ENROLLED',
        message: 'Enroll to write notes',
        requestId: req.id,
      });
    }

    const note = await Note.create({
      student: req.user._id,
      course: lesson.course,
      lesson: lesson._id,
      content: req.body.content,
    });

    res.status(201).json({ success: true, data: note });
  } catch (err) {
    next(err);
  }
};

export const updateNote = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Note not found',
        requestId: req.id,
      });
    }
    if (String(note.student) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You cannot edit this note',
        requestId: req.id,
      });
    }

    note.content = req.body.content;
    await note.save();

    res.json({ success: true, data: note });
  } catch (err) {
    next(err);
  }
};

export const deleteNote = async (req, res, next) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Note not found',
        requestId: req.id,
      });
    }
    if (String(note.student) !== String(req.user._id) && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You cannot delete this note',
        requestId: req.id,
      });
    }
    await note.deleteOne();
    res.json({ success: true, message: 'Note deleted' });
  } catch (err) {
    next(err);
  }
};