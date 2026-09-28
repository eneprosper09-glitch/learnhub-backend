import Enrollment from '../models/Enrollment.js';
import Course from '../models/Course.js';
import Lesson from '../models/Lesson.js';
import Progress from '../models/Progress.js';

export const enrollInCourse = async (req, res, next) => {
  try {
    if (!req.user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Please verify your email before enrolling in a course.',
        requestId: req.id,
      });
    }

    const courseId = req.params.id;
    const course = await Course.findOne({ _id: courseId, isDeleted: false });
    if (!course) {
      return res.status(404).json({
        success: false,
        code: 'COURSE_NOT_FOUND',
        message: 'Course not found',
        requestId: req.id,
      });
    }

    if (!course.isPublished && String(course.instructor) !== String(req.user._id)) {
      return res.status(400).json({
        success: false,
        code: 'VALIDATION_FAILED',
        message: 'This course is not open for enrollment',
        requestId: req.id,
      });
    }

    const existing = await Enrollment.findOne({
      student: req.user._id,
      course: courseId,
    });

    if (existing && existing.status === 'active') {
      return res.json({ success: true, data: existing });
    }

    const price = Number(course.price) || 0;

    if (existing && existing.status === 'unenrolled' && existing.paid) {
      existing.status = 'active';
      existing.unenrolledAt = undefined;
      await existing.save();
      await Course.findByIdAndUpdate(courseId, { $inc: { totalStudents: 1 } });
      return res.json({ success: true, data: existing });
    }

    if (price > 0) {
      const providedAmount = Number(req.body?.amount) || 0;
      if (req.body?.paid !== true || providedAmount < price) {
        return res.status(402).json({
          success: false,
          code: 'PAYMENT_REQUIRED',
          message: `This course costs $${price}. Complete payment to enroll.`,
          amount: price,
          requestId: req.id,
        });
      }
    }

    const totalLessons = await Lesson.countDocuments({
      course: courseId,
      isDeleted: false,
    });

    let enrollment;
    if (existing) {
      existing.status = 'active';
      existing.unenrolledAt = undefined;
      existing.totalLessons = totalLessons;
      existing.courseSnapshot = {
        title: course.title,
        price: course.price,
        thumbnailUrl: course.thumbnailUrl,
      };
      if (price > 0) {
        existing.paid = true;
        existing.paidAmount = price;
        existing.paidAt = new Date();
      }
      await existing.save();
      enrollment = existing;
    } else {
      enrollment = await Enrollment.create({
        student: req.user._id,
        course: courseId,
        totalLessons,
        courseSnapshot: {
          title: course.title,
          price: course.price,
          thumbnailUrl: course.thumbnailUrl,
        },
        paid: price > 0,
        paidAmount: price > 0 ? price : 0,
        paidAt: price > 0 ? new Date() : undefined,
      });
    }

    await Course.findByIdAndUpdate(courseId, { $inc: { totalStudents: 1 } });

    res.status(201).json({ success: true, data: enrollment });
  } catch (err) {
    next(err);
  }
};

export const unenrollFromCourse = async (req, res, next) => {
  try {
    const courseId = req.params.courseId;
    const enrollment = await Enrollment.findOne({
      student: req.user._id,
      course: courseId,
    });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'You are not enrolled in this course',
        requestId: req.id,
      });
    }

    if (enrollment.status === 'unenrolled') {
      return res.json({ success: true, message: 'Already unenrolled' });
    }

    enrollment.status = 'unenrolled';
    enrollment.unenrolledAt = new Date();
    await enrollment.save();

    await Course.findByIdAndUpdate(courseId, { $inc: { totalStudents: -1 } });

    res.json({ success: true, message: 'Unenrolled successfully' });
  } catch (err) {
    next(err);
  }
};

export const getMyEnrollments = async (req, res, next) => {
  try {
    const enrollments = await Enrollment.find({
      student: req.user._id,
      status: 'active',
    })
      .populate('course', 'title slug thumbnailUrl instructor totalLessons price')
      .sort('-createdAt');

    res.json({
      success: true,
      count: enrollments.length,
      data: enrollments,
    });
  } catch (err) {
    next(err);
  }
};

export const markLessonComplete = async (req, res, next) => {
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

    let enrollment = await Enrollment.findOne({
      student: req.user._id,
      course: lesson.course,
    });

    if (!enrollment) {
      const course = await Course.findById(lesson.course);
      const isOwner = course && String(course.instructor) === String(req.user._id);
      if (req.user.role === 'admin' || isOwner) {
        const totalLessons = await Lesson.countDocuments({
          course: lesson.course,
          isDeleted: false,
        });
        enrollment = await Enrollment.create({
          student: req.user._id,
          course: lesson.course,
          totalLessons,
          courseSnapshot: {
            title: course?.title,
            price: course?.price,
            thumbnailUrl: course?.thumbnailUrl,
          },
          status: 'active',
        });
      } else {
        return res.status(403).json({
          success: false,
          code: 'LESSON_LOCKED',
          message: 'Enroll in this course to track progress',
          requestId: req.id,
        });
      }
    }

    const existing = await Progress.findOne({
      student: req.user._id,
      course: lesson.course,
      lesson: lesson._id,
    });

    if (!existing) {
      await Progress.create({
        student: req.user._id,
        course: lesson.course,
        lesson: lesson._id,
      });
    }

    const totalLessons = await Lesson.countDocuments({
      course: lesson.course,
      isDeleted: false,
    });
    const completed = await Progress.countDocuments({
      student: req.user._id,
      course: lesson.course,
    });
    const pct = totalLessons > 0 ? Math.round((completed / totalLessons) * 100) : 0;

    enrollment.completedCount = completed;
    enrollment.totalLessons = totalLessons;
    enrollment.progressPercent = pct;
    await enrollment.save();

    res.json({
      success: true,
      data: {
        progressPercent: pct,
        completedCount: completed,
        totalLessons,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getMyProgress = async (req, res, next) => {
  try {
    const courseId = req.params.courseId;

    const enrollment = await Enrollment.findOne({
      student: req.user._id,
      course: courseId,
    });

    if (!enrollment) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Not enrolled in this course',
        requestId: req.id,
      });
    }

    const lessons = await Lesson.find({ course: courseId, isDeleted: false }).sort('order');
    const progress = await Progress.find({ student: req.user._id, course: courseId });
    const completedIds = new Set(progress.map((p) => String(p.lesson)));

    res.json({
      success: true,
      data: {
        progressPercent: enrollment.progressPercent,
        completedCount: enrollment.completedCount,
        totalLessons: enrollment.totalLessons,
        lessons: lessons.map((l) => ({
          _id: l._id,
          title: l.title,
          order: l.order,
          isFree: l.isFree,
          completed: completedIds.has(String(l._id)),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};