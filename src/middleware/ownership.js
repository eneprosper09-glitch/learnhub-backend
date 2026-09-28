import Course from '../models/Course.js';

export const ownsCourse = async (req, res, next) => {
  try {
    const courseId = req.params.id || req.params.courseId || req.body.courseId;
    if (!courseId) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'Course id required',
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

    if (req.user.role === 'admin') {
      req.course = course;
      return next();
    }

    if (String(course.instructor) !== String(req.user._id)) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You do not own this course',
        requestId: req.id,
      });
    }

    req.course = course;
    next();
  } catch (err) {
    next(err);
  }
};