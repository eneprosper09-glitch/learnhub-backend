import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';

export const getRecommendedCourses = async (req, res, next) => {
  try {
    // If not logged in, return the most popular published courses
    if (!req.user) {
      const data = await Course.find({ isPublished: true, isDeleted: false })
        .populate('instructor', 'name avatarUrl')
        .populate('category', 'name')
        .sort('-totalStudents')
        .limit(6);
      return res.json({ success: true, based: 'popular', data });
    }

    // Get enrolled course categories
    const enrollments = await Enrollment.find({
      student: req.user._id,
      status: 'active',
    }).populate('course', 'category');

    const enrolledCourseIds = enrollments.map((e) => String(e.course?._id));
    const categoryIds = [
      ...new Set(
        enrollments
          .map((e) => e.course?.category)
          .filter(Boolean)
          .map((c) => String(c))
      ),
    ];

    let data = [];

    if (categoryIds.length > 0) {
      data = await Course.find({
        category: { $in: categoryIds },
        isPublished: true,
        isDeleted: false,
        _id: { $nin: enrolledCourseIds },
      })
        .populate('instructor', 'name avatarUrl')
        .populate('category', 'name')
        .sort('-averageRating -totalStudents')
        .limit(6);
    }

    // Fallback: popular courses not already enrolled
    if (data.length === 0) {
      data = await Course.find({
        isPublished: true,
        isDeleted: false,
        _id: { $nin: enrolledCourseIds },
      })
        .populate('instructor', 'name avatarUrl')
        .populate('category', 'name')
        .sort('-totalStudents')
        .limit(6);
    }

    res.json({
      success: true,
      based: categoryIds.length > 0 ? 'category' : 'popular',
      data,
    });
  } catch (err) {
    next(err);
  }
};