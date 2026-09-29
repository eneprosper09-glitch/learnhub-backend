import Certificate from '../models/Certificate.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';

const generateCertId = () => {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  const stamp = Date.now().toString(36).toUpperCase();
  return `LH-${stamp}-${rand}`;
};

export const getCertificateForCourse = async (req, res, next) => {
  try {
    const { courseId } = req.params;

    const enrollment = await Enrollment.findOne({
      student: req.user._id,
      course: courseId,
    });
    if (!enrollment) {
      return res.status(403).json({
        success: false,
        code: 'NOT_ENROLLED',
        message: 'You are not enrolled in this course',
        requestId: req.id,
      });
    }

    if ((enrollment.progressPercent || 0) < 100) {
      return res.status(400).json({
        success: false,
        code: 'NOT_COMPLETED',
        message: 'Complete all lessons to unlock the certificate',
        requestId: req.id,
      });
    }

    let certificate = await Certificate.findOne({
      student: req.user._id,
      course: courseId,
    });

    if (!certificate) {
      certificate = await Certificate.create({
        student: req.user._id,
        course: courseId,
        certificateId: generateCertId(),
      });
    }

    const course = await Course.findById(courseId)
      .populate('instructor', 'name')
      .populate('category', 'name');

    res.json({
      success: true,
      data: {
        certificateId: certificate.certificateId,
        issuedAt: certificate.issuedAt,
        student: {
          _id: req.user._id,
          name: req.user.name,
        },
        course: {
          _id: course._id,
          title: course.title,
          level: course.level,
          category: course.category?.name,
          instructor: course.instructor?.name,
          totalLessons: course.totalLessons,
        },
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getMyCertificates = async (req, res, next) => {
  try {
    const certs = await Certificate.find({ student: req.user._id })
      .populate('course', 'title thumbnailUrl instructor')
      .sort('-issuedAt');
    res.json({ success: true, count: certs.length, data: certs });
  } catch (err) {
    next(err);
  }
};

export const verifyCertificate = async (req, res, next) => {
  try {
    const certificate = await Certificate.findOne({
      certificateId: req.params.certificateId,
    })
      .populate('student', 'name')
      .populate({
        path: 'course',
        select: 'title instructor',
        populate: { path: 'instructor', select: 'name' },
      });

    if (!certificate) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Certificate not found',
        requestId: req.id,
      });
    }

    res.json({
      success: true,
      data: {
        certificateId: certificate.certificateId,
        issuedAt: certificate.issuedAt,
        studentName: certificate.student?.name,
        courseTitle: certificate.course?.title,
        instructorName: certificate.course?.instructor?.name,
      },
    });
  } catch (err) {
    next(err);
  }
};