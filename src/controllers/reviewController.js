import mongoose from 'mongoose';
import Review from '../models/Review.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import Notification from '../models/Notification.js';

const recalcCourseRating = async (courseId) => {
  const agg = await Review.aggregate([
    { $match: { course: new mongoose.Types.ObjectId(courseId) } },
    { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);
  const avg = agg[0]?.avg || 0;
  const count = agg[0]?.count || 0;
  await Course.findByIdAndUpdate(courseId, {
    averageRating: Math.round(avg * 10) / 10,
    totalReviews: count,
  });
  return { avg: Math.round(avg * 10) / 10, count };
};

export const getCourseReviews = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const reviews = await Review.find({ course: courseId })
      .populate('student', 'name avatarUrl')
      .sort('-createdAt');

    const count = reviews.length;
    const avg = count > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;

    res.json({
      success: true,
      count,
      averageRating: Math.round(avg * 10) / 10,
      data: reviews.map((r) => ({
        _id: r._id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        student: {
          _id: r.student?._id,
          name: r.student?.name,
          avatarUrl: r.student?.avatarUrl,
        },
      })),
    });
  } catch (err) {
    next(err);
  }
};

export const getMyReview = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const review = await Review.findOne({
      student: req.user._id,
      course: courseId,
    });
    res.json({ success: true, data: review });
  } catch (err) {
    next(err);
  }
};

export const upsertReview = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { rating, comment } = req.body;

    const course = await Course.findOne({ _id: courseId, isDeleted: false });
    if (!course) {
      return res.status(404).json({
        success: false,
        code: 'COURSE_NOT_FOUND',
        message: 'Course not found',
        requestId: req.id,
      });
    }

    const enrollment = await Enrollment.findOne({
      student: req.user._id,
      course: courseId,
    });
    if (!enrollment) {
      return res.status(403).json({
        success: false,
        code: 'NOT_ENROLLED',
        message: 'You must be enrolled in this course to leave a review.',
        requestId: req.id,
      });
    }

    const existing = await Review.findOne({
      student: req.user._id,
      course: courseId,
    });

    const review = await Review.findOneAndUpdate(
      { student: req.user._id, course: courseId },
      {
        student: req.user._id,
        course: courseId,
        instructor: course.instructor,
        rating,
        comment,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

    const { avg, count } = await recalcCourseRating(courseId);

    // Notify the instructor only when a review is newly created (not on update)
    if (!existing && String(course.instructor) !== String(req.user._id)) {
      try {
        await Notification.create({
          user: course.instructor,
          type: 'review',
          title: 'New review on your course',
          body: `${req.user.name} rated "${course.title}" ${rating} stars`,
          link: `/courses/${course._id}`,
        });
      } catch (notifyErr) {
        console.warn('Failed to create review notification:', notifyErr.message);
      }
    }

    res.status(201).json({
      success: true,
      data: review,
      averageRating: avg,
      totalReviews: count,
    });
  } catch (err) {
    next(err);
  }
};

export const deleteReview = async (req, res, next) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Review not found',
        requestId: req.id,
      });
    }

    const isOwner = String(review.student) === String(req.user._id);
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You cannot delete this review',
        requestId: req.id,
      });
    }

    const courseId = review.course;
    await review.deleteOne();
    await recalcCourseRating(courseId);

    res.json({ success: true, message: 'Review deleted' });
  } catch (err) {
    next(err);
  }
};

export const getInstructorReviews = async (req, res, next) => {
  try {
    const { instructorId } = req.params;
    const reviews = await Review.find({ instructor: instructorId })
      .populate('student', 'name avatarUrl')
      .populate('course', 'title')
      .sort('-createdAt');

    const count = reviews.length;
    const avg = count > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;

    res.json({
      success: true,
      count,
      averageRating: Math.round(avg * 10) / 10,
      data: reviews.map((r) => ({
        _id: r._id,
        rating: r.rating,
        comment: r.comment,
        createdAt: r.createdAt,
        student: {
          _id: r.student?._id,
          name: r.student?.name,
          avatarUrl: r.student?.avatarUrl,
        },
        course: { _id: r.course?._id, title: r.course?.title },
      })),
    });
  } catch (err) {
    next(err);
  }
};

export const getInstructorProfile = async (req, res, next) => {
  try {
    const { instructorId } = req.params;
    const User = (await import('../models/User.js')).default;

    const instructor = await User.findOne({
      _id: instructorId,
      isDeleted: false,
    }).select('name email avatarUrl bio role createdAt');

    if (!instructor) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Instructor not found',
        requestId: req.id,
      });
    }

    const courses = await Course.find({
      instructor: instructorId,
      isPublished: true,
      isDeleted: false,
    })
      .populate('category', 'name')
      .sort('-createdAt');

    const reviews = await Review.find({ instructor: instructorId })
      .populate('student', 'name avatarUrl')
      .populate('course', 'title')
      .sort('-createdAt');

    const count = reviews.length;
    const avg = count > 0 ? reviews.reduce((s, r) => s + r.rating, 0) / count : 0;
    const totalStudents = courses.reduce((sum, c) => sum + (c.totalStudents || 0), 0);

    res.json({
      success: true,
      data: {
        instructor: {
          _id: instructor._id,
          name: instructor.name,
          avatarUrl: instructor.avatarUrl,
          bio: instructor.bio,
          memberSince: instructor.createdAt,
        },
        stats: {
          courses: courses.length,
          students: totalStudents,
          averageRating: Math.round(avg * 10) / 10,
          totalReviews: count,
        },
        courses,
        reviews: reviews.slice(0, 10).map((r) => ({
          _id: r._id,
          rating: r.rating,
          comment: r.comment,
          createdAt: r.createdAt,
          student: {
            _id: r.student?._id,
            name: r.student?.name,
            avatarUrl: r.student?.avatarUrl,
          },
          course: { _id: r.course?._id, title: r.course?.title },
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};