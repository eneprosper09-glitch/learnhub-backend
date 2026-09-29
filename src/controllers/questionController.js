import Question from '../models/Question.js';
import Lesson from '../models/Lesson.js';
import Course from '../models/Course.js';
import Enrollment from '../models/Enrollment.js';
import Notification from '../models/Notification.js';

export const getQuestionsForLesson = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const questions = await Question.find({
      lesson: lessonId,
      isDeleted: false,
    })
      .populate('student', 'name avatarUrl role')
      .populate('answers.user', 'name avatarUrl role')
      .sort('-createdAt');

    res.json({ success: true, count: questions.length, data: questions });
  } catch (err) {
    next(err);
  }
};

export const createQuestion = async (req, res, next) => {
  try {
    const { lessonId } = req.params;
    const lesson = await Lesson.findById(lessonId);
    if (!lesson || lesson.isDeleted) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Lesson not found',
        requestId: req.id,
      });
    }

    const enrollment = await Enrollment.findOne({
      student: req.user._id,
      course: lesson.course,
    });
    if (!enrollment && req.user.role === 'student') {
      return res.status(403).json({
        success: false,
        code: 'NOT_ENROLLED',
        message: 'Enroll to ask questions',
        requestId: req.id,
      });
    }

    const question = await Question.create({
      lesson: lesson._id,
      course: lesson.course,
      student: req.user._id,
      title: req.body.title,
      body: req.body.body,
    });

    await question.populate('student', 'name avatarUrl role');

    // Notify the instructor
    const course = await Course.findById(lesson.course);
    if (course && String(course.instructor) !== String(req.user._id)) {
      await Notification.create({
        user: course.instructor,
        type: 'answer',
        title: 'New question on your course',
        body: `${req.user.name} asked: "${req.body.title}"`,
        link: `/learn/${course._id}/${lesson._id}`,
      });
    }

    res.status(201).json({ success: true, data: question });
  } catch (err) {
    next(err);
  }
};

export const answerQuestion = async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question || question.isDeleted) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Question not found',
        requestId: req.id,
      });
    }

    const course = await Course.findById(question.course);
    const isInstructor = course && String(course.instructor) === String(req.user._id);
    const isAdmin = req.user.role === 'admin';
    const enrollment = await Enrollment.findOne({
      student: req.user._id,
      course: question.course,
    });

    if (!isInstructor && !isAdmin && !enrollment) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You cannot answer in this course',
        requestId: req.id,
      });
    }

    question.answers.push({
      user: req.user._id,
      body: req.body.body,
      isInstructorAnswer: isInstructor || isAdmin,
    });
    await question.save();
    await question.populate('student', 'name avatarUrl role');
    await question.populate('answers.user', 'name avatarUrl role');

    // Notify the student who asked
    if (String(question.student._id) !== String(req.user._id)) {
      await Notification.create({
        user: question.student._id,
        type: 'answer',
        title: 'Your question got an answer',
        body: `${req.user.name} answered: "${question.title}"`,
        link: `/learn/${question.course}/${question.lesson}`,
      });
    }

    res.status(201).json({ success: true, data: question });
  } catch (err) {
    next(err);
  }
};

export const resolveQuestion = async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question || question.isDeleted) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Question not found',
        requestId: req.id,
      });
    }

    const isOwner = String(question.student._id) === String(req.user._id);
    const isAdmin = req.user.role === 'admin';
    const course = await Course.findById(question.course);
    const isInstructor = course && String(course.instructor) === String(req.user._id);

    if (!isOwner && !isAdmin && !isInstructor) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You cannot resolve this question',
        requestId: req.id,
      });
    }

    question.isResolved = !question.isResolved;
    await question.save();

    res.json({ success: true, data: question });
  } catch (err) {
    next(err);
  }
};

export const deleteQuestion = async (req, res, next) => {
  try {
    const question = await Question.findById(req.params.id);
    if (!question) {
      return res.status(404).json({
        success: false,
        code: 'NOT_FOUND',
        message: 'Question not found',
        requestId: req.id,
      });
    }

    const isOwner = String(question.student._id) === String(req.user._id);
    const isAdmin = req.user.role === 'admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({
        success: false,
        code: 'FORBIDDEN',
        message: 'You cannot delete this question',
        requestId: req.id,
      });
    }

    question.isDeleted = true;
    await question.save();

    res.json({ success: true, message: 'Question deleted' });
  } catch (err) {
    next(err);
  }
};