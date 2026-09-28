import Course from '../models/Course.js';
import Lesson from '../models/Lesson.js';
import Enrollment from '../models/Enrollment.js';
import { toSlug } from '../utils/slugify.js';
import { deleteAsset } from '../services/cloudinary.service.js';

export const getCourses = async (req, res, next) => {
  try {
    const { search, category, level, sort = '-createdAt', page = 1, limit = 12 } = req.query;
    const query = { isPublished: true, isDeleted: false };

    if (category) query.category = category;
    if (level) query.level = level;

    const parsedLimit = Math.min(Number(limit) || 12, 100);
    const skip = (Number(page) - 1) * parsedLimit;

    if (search) query.$text = { $search: search };

    const [data, total] = await Promise.all([
      Course.find(query)
        .populate('instructor', 'name avatarUrl')
        .populate('category', 'name slug')
        .sort(sort)
        .skip(skip)
        .limit(parsedLimit),
      Course.countDocuments(query),
    ]);

    res.json({
      success: true,
      count: data.length,
      total,
      page: Number(page),
      pages: Math.ceil(total / parsedLimit) || 1,
      data,
    });
  } catch (err) {
    next(err);
  }
};

export const getCourse = async (req, res, next) => {
  try {
    const course = await Course.findOne({ _id: req.params.id, isDeleted: false })
      .populate('instructor', 'name avatarUrl bio')
      .populate('category', 'name slug');

    if (!course) {
      return res.status(404).json({
        success: false,
        code: 'COURSE_NOT_FOUND',
        message: 'Course not found',
        requestId: req.id,
      });
    }

    const lessons = await Lesson.find({ course: course._id, isDeleted: false }).sort('order');

    let enrolled = false;
    let previouslyEnrolled = false;
    let previouslyPaid = false;

    if (req.user) {
      const enrollment = await Enrollment.findOne({
        student: req.user._id,
        course: course._id,
      });
      if (enrollment) {
        previouslyEnrolled = true;
        previouslyPaid = !!enrollment.paid;
        enrolled = enrollment.status === 'active';
      }
    }

    const isOwner =
      req.user &&
      (req.user.role === 'admin' ||
        String(course.instructor._id) === String(req.user._id));

    const safeLessons = lessons.map((l) => {
      const showVideo = l.isFree || enrolled || isOwner;
      return {
        _id: l._id,
        title: l.title,
        description: l.description,
        duration: l.duration,
        order: l.order,
        isFree: l.isFree,
        videoUrl: showVideo ? l.videoUrl : undefined,
        locked: !showVideo,
      };
    });

    res.json({
      success: true,
      data: {
        ...course.toObject(),
        lessons: safeLessons,
        enrolled,
        previouslyEnrolled,
        previouslyPaid,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const createCourse = async (req, res, next) => {
  try {
    const {
      title,
      description,
      category,
      price,
      level,
      language,
      thumbnailUrl,
      thumbnailPublicId,
    } = req.body;

    if (req.user.role === 'instructor' && !req.user.isInstructorApproved) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'Your instructor account is awaiting approval',
        requestId: req.id,
      });
    }

    let slug = toSlug(title);
    const existing = await Course.findOne({ slug });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const course = await Course.create({
      title,
      slug,
      description,
      category: category || undefined,
      instructor: req.user._id,
      price: price || 0,
      level: level || 'beginner',
      language: language || 'English',
      thumbnailUrl,
      thumbnailPublicId,
    });

    res.status(201).json({ success: true, data: course });
  } catch (err) {
    next(err);
  }
};

export const updateCourse = async (req, res, next) => {
  try {
    const course = req.course;

    // If the thumbnail changed, delete the old asset.
    if (
      req.body.thumbnailPublicId &&
      course.thumbnailPublicId &&
      req.body.thumbnailPublicId !== course.thumbnailPublicId
    ) {
      await deleteAsset(course.thumbnailPublicId, 'image');
    }

    const allowed = [
      'title',
      'description',
      'category',
      'price',
      'level',
      'language',
      'thumbnailUrl',
      'thumbnailPublicId',
    ];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) course[field] = req.body[field];
    });
    if (req.body.title) {
      course.slug = toSlug(req.body.title);
    }
    await course.save();
    res.json({ success: true, data: course });
  } catch (err) {
    next(err);
  }
};

export const deleteCourse = async (req, res, next) => {
  try {
    const course = req.course;

    // Delete all lesson videos from Cloudinary.
    const lessons = await Lesson.find({ course: course._id, isDeleted: false });
    for (const lesson of lessons) {
      if (lesson.videoPublicId) {
        await deleteAsset(lesson.videoPublicId, 'video');
      }
    }

    // Delete the course thumbnail.
    if (course.thumbnailPublicId) {
      await deleteAsset(course.thumbnailPublicId, 'image');
    }

    course.isDeleted = true;
    await course.save();
    await Lesson.updateMany({ course: course._id }, { isDeleted: true });

    res.json({ success: true, message: 'Course deleted' });
  } catch (err) {
    next(err);
  }
};

export const togglePublish = async (req, res, next) => {
  try {
    const course = req.course;
    course.isPublished = !course.isPublished;
    await course.save();
    res.json({ success: true, data: course });
  } catch (err) {
    next(err);
  }
};

export const getInstructorCourses = async (req, res, next) => {
  try {
    const data = await Course.find({
      instructor: req.user._id,
      isDeleted: false,
    })
      .populate('category', 'name slug')
      .sort('-createdAt');

    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};

export const getCourseStudents = async (req, res, next) => {
  try {
    const course = req.course;

    const enrollments = await Enrollment.find({
      course: course._id,
      status: 'active',
    })
      .populate('student', 'name email avatarUrl')
      .sort('-createdAt');

    res.json({
      success: true,
      count: enrollments.length,
      data: enrollments.map((e) => ({
        student: e.student,
        progressPercent: e.progressPercent,
        completedCount: e.completedCount,
        totalLessons: e.totalLessons,
        enrolledAt: e.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
};

export const getAllCoursesAdmin = async (req, res, next) => {
  try {
    const { search = '', limit = 100 } = req.query;

    const query = { isDeleted: false };
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    const data = await Course.find(query)
      .populate('instructor', 'name')
      .populate('category', 'name')
      .sort('-createdAt')
      .limit(Number(limit));

    res.json({ success: true, count: data.length, data });
  } catch (err) {
    next(err);
  }
};