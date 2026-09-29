import Section from '../models/Section.js';
import Lesson from '../models/Lesson.js';
import Course from '../models/Course.js';

export const createSection = async (req, res, next) => {
  try {
    const course = req.course;
    const { title, description } = req.body;

    const last = await Section.findOne({ course: course._id, isDeleted: false }).sort(
      '-order'
    );
    const order = last ? last.order + 1 : 1;

    const section = await Section.create({
      course: course._id,
      title,
      description,
      order,
    });

    res.status(201).json({ success: true, data: section });
  } catch (err) {
    next(err);
  }
};

export const updateSection = async (req, res, next) => {
  try {
    const section = await Section.findById(req.params.id);
    if (!section || section.isDeleted) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Section not found',
        requestId: req.id,
      });
    }

    if (req.user.role !== 'admin') {
      const course = await Course.findById(section.course);
      if (!course || String(course.instructor) !== String(req.user._id)) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'You do not own this section',
          requestId: req.id,
        });
      }
    }

    const allowed = ['title', 'description'];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) section[field] = req.body[field];
    });
    await section.save();

    res.json({ success: true, data: section });
  } catch (err) {
    next(err);
  }
};

export const deleteSection = async (req, res, next) => {
  try {
    const section = await Section.findById(req.params.id);
    if (!section || section.isDeleted) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Section not found',
        requestId: req.id,
      });
    }

    if (req.user.role !== 'admin') {
      const course = await Course.findById(section.course);
      if (!course || String(course.instructor) !== String(req.user._id)) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'You do not own this section',
          requestId: req.id,
        });
      }
    }

    section.isDeleted = true;
    await section.save();

    // Orphan lessons in this section: keep them but detach from the section
    await Lesson.updateMany({ section: section._id }, { section: null });

    // Re-number remaining sections
    const remaining = await Section.find({
      course: section.course,
      isDeleted: false,
    }).sort('order');
    for (let i = 0; i < remaining.length; i++) {
      remaining[i].order = i + 1;
      await remaining[i].save();
    }

    res.json({ success: true, message: 'Section deleted' });
  } catch (err) {
    next(err);
  }
};

export const reorderSections = async (req, res, next) => {
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
      await Section.updateOne({ _id: order[i], course: courseId }, { order: i + 1 });
    }

    res.json({ success: true, message: 'Sections reordered' });
  } catch (err) {
    next(err);
  }
};

export const getSectionsByCourse = async (req, res, next) => {
  try {
    const data = await Section.find({
      course: req.params.courseId,
      isDeleted: false,
    }).sort('order');
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};