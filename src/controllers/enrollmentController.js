import Enrollment from '../models/Enrollment.js';
import Course from '../models/Course.js';
import Lesson from '../models/Lesson.js';
import Progress from '../models/Progress.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';

const calculateFinalPrice = (course) => {
  const price = Number(course.price) || 0;
  const discount = Number(course.discountPercent) || 0;
  if (discount <= 0) return price;
  return Math.round((price - (price * discount) / 100) * 100) / 100;
};

const updateStreak = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const last = user.lastActivityDate ? new Date(user.lastActivityDate) : null;
  if (last) last.setHours(0, 0, 0, 0);

  if (!last) {
    user.currentStreak = 1;
    user.longestStreak = Math.max(user.longestStreak || 0, 1);
  } else {
    const dayMs = 24 * 60 * 60 * 1000;
    const diff = Math.round((today - last) / dayMs);
    if (diff === 0) {
      // same day
    } else if (diff === 1) {
      user.currentStreak = (user.currentStreak || 0) + 1;
      if (user.currentStreak > (user.longestStreak || 0)) {
        user.longestStreak = user.currentStreak;
      }
    } else {
      user.currentStreak = 1;
    }
  }
  user.lastActivityDate = new Date();
  await user.save();
};

export const enrollInCourse = async (req, res, next) => {
  try {
    // Instructors cannot enroll in any course. Admins can (they moderate and
    // may need to test the student flow). This is the load-bearing rule.
    if (req.user.role === 'instructor') {
      return res.status(403).json({
        success: false,
        code: 'INSTRUCTORS_CANNOT_ENROLL',
        message: 'Instructor accounts cannot enroll in courses.',
        requestId: req.id,
      });
    }

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

    // Belt and suspenders: even if an admin somehow tried to enroll in a
    // course they instruct, block it. Normally the instructor check above
    // catches this, but admins are excluded from that check.
    if (String(course.instructor) === String(req.user._id)) {
      return res.status(403).json({
        success: false,
        code: 'CANNOT_ENROLL_OWN_COURSE',
        message: 'You cannot enroll in your own course.',
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

    const finalPrice = calculateFinalPrice(course);

    if (existing && existing.status === 'unenrolled' && existing.paid) {
      existing.status = 'active';
      existing.unenrolledAt = undefined;
      await existing.save();
      await Course.findByIdAndUpdate(courseId, { $inc: { totalStudents: 1 } });
      return res.json({ success: true, data: existing });
    }

    if (finalPrice > 0) {
      const providedAmount = Number(req.body?.amount) || 0;
      if (req.body?.paid !== true || providedAmount < finalPrice) {
        return res.status(402).json({
          success: false,
          code: 'PAYMENT_REQUIRED',
          message: `This course costs $${finalPrice}. Complete payment to enroll.`,
          amount: finalPrice,
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
        price: finalPrice,
        thumbnailUrl: course.thumbnailUrl,
      };
      if (finalPrice > 0) {
        existing.paid = true;
        existing.paidAmount = finalPrice;
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
          price: finalPrice,
          thumbnailUrl: course.thumbnailUrl,
        },
        paid: finalPrice > 0,
        paidAmount: finalPrice > 0 ? finalPrice : 0,
        paidAt: finalPrice > 0 ? new Date() : undefined,
      });
    }

    await Course.findByIdAndUpdate(courseId, { $inc: { totalStudents: 1 } });

    // Notify instructor of new enrollment
    await Notification.create({
      user: course.instructor,
      type: 'enrollment',
      title: 'New enrollment',
      body: `${req.user.name} enrolled in "${course.title}"`,
      link: `/instructor/courses/${course._id}/students`,
    });

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
      .populate(
        'course',
        'title slug thumbnailUrl instructor totalLessons price discountPercent'
      )
      .sort('-createdAt');

    res.json({ success: true, count: enrollments.length, data: enrollments });
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

      // Instructors can mark lessons complete in their own courses (for
      // previewing), but not in other instructors' courses. Admins can do
      // either. Everyone else needs an enrollment.
      if (req.user.role === 'instructor' && !isOwner) {
        return res.status(403).json({
          success: false,
          code: 'LESSON_LOCKED',
          message: 'Instructor accounts cannot track progress in other instructors\' courses.',
          requestId: req.id,
        });
      }

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
      await updateStreak(req.user._id);
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

    // Notify certificate available when just reached 100%
    if (pct === 100) {
      const course = await Course.findById(lesson.course);
      await Notification.create({
        user: req.user._id,
        type: 'certificate',
        title: 'Certificate unlocked',
        body: `You completed "${course?.title}". Your certificate is ready.`,
        link: `/certificates/${lesson.course}`,
      });
    }

    res.json({
      success: true,
      data: { progressPercent: pct, completedCount: completed, totalLessons },
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

export const getMyStreak = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select(
      'currentStreak longestStreak lastActivityDate'
    );
    res.json({
      success: true,
      data: {
        currentStreak: user?.currentStreak || 0,
        longestStreak: user?.longestStreak || 0,
        lastActivityDate: user?.lastActivityDate || null,
      },
    });
  } catch (err) {
    next(err);
  }
};