import express from 'express';
import * as c from '../controllers/courseController.js';
import * as lessonCtrl from '../controllers/lessonController.js';
import { protect } from '../middleware/auth.js';
import { authorize } from '../middleware/authorize.js';
import { ownsCourse } from '../middleware/ownership.js';
import { validate } from '../middleware/validate.js';
import { createCourseRules, updateCourseRules } from '../validators/course.validator.js';
import { createLessonRules } from '../validators/lesson.validator.js';
import { getRecommendedCourses } from '../controllers/recommendationController.js';

const router = express.Router();

router.get('/', c.getCourses);
router.get('/recommended', protect, getRecommendedCourses);

router.get('/admin/all', protect, authorize('admin'), c.getAllCoursesAdmin);

router.get(
  '/instructor/mine',
  protect,
  authorize('instructor', 'admin'),
  c.getInstructorCourses
);

router.get('/:id', protect, c.getCourse);

router.post(
  '/',
  protect,
  authorize('instructor', 'admin'),
  createCourseRules,
  validate,
  c.createCourse
);

router.put(
  '/:id',
  protect,
  authorize('instructor', 'admin'),
  ownsCourse,
  updateCourseRules,
  validate,
  c.updateCourse
);

router.delete(
  '/:id',
  protect,
  authorize('instructor', 'admin'),
  ownsCourse,
  c.deleteCourse
);

router.put(
  '/:id/publish',
  protect,
  authorize('instructor', 'admin'),
  ownsCourse,
  c.togglePublish
);

router.get(
  '/:id/students',
  protect,
  authorize('instructor', 'admin'),
  ownsCourse,
  c.getCourseStudents
);

router.post(
  '/:id/lessons',
  protect,
  authorize('instructor', 'admin'),
  ownsCourse,
  createLessonRules,
  validate,
  lessonCtrl.createLesson
);

router.get('/:courseId/lessons', lessonCtrl.getLessonsByCourse);

export default router;