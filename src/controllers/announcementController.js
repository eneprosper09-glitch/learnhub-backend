import Announcement from '../models/Announcement.js';
import Course from '../models/Course.js';

export const getCourseAnnouncements = async (req, res, next) => {
  try {
    const data = await Announcement.find({
      course: req.params.courseId,
      isDeleted: false,
    })
      .populate('instructor', 'name avatarUrl')
      .sort('-createdAt');
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};

export const createAnnouncement = async (req, res, next) => {
  try {
    const course = req.course;
    const { title, body } = req.body;

    const announcement = await Announcement.create({
      course: course._id,
      instructor: req.user._id,
      title,
      body,
    });

    await announcement.populate('instructor', 'name avatarUrl');

    res.status(201).json({ success: true, data: announcement });
  } catch (err) {
    next(err);
  }
};

export const deleteAnnouncement = async (req, res, next) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement || announcement.isDeleted) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Announcement not found',
        requestId: req.id,
      });
    }

    if (req.user.role !== 'admin') {
      const course = await Course.findById(announcement.course);
      if (!course || String(course.instructor) !== String(req.user._id)) {
        return res.status(403).json({
          success: false,
          code: 'FORBIDDEN',
          message: 'You do not own this course',
          requestId: req.id,
        });
      }
    }

    announcement.isDeleted = true;
    await announcement.save();

    res.json({ success: true, message: 'Announcement deleted' });
  } catch (err) {
    next(err);
  }
};