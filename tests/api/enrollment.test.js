import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../../src/app.js';
import User from '../../src/models/User.js';
import Course from '../../src/models/Course.js';
import Enrollment from '../../src/models/Enrollment.js';

let mongo;
let instructorToken;
let studentToken;
let courseId;
let paidCourseId;

const registerAndLogin = async (payload) => {
  await request(app).post('/api/v1/auth/register').send(payload);
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email: payload.email, password: payload.password });
  return login.body.accessToken;
};

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await User.deleteMany({});
  await Course.deleteMany({});
  await Enrollment.deleteMany({});

  await registerAndLogin({
    name: 'Instructor',
    email: 'instructor@test.com',
    password: 'Password123!',
    role: 'instructor',
  });

  await User.updateOne(
    { email: 'instructor@test.com' },
    { $set: { isInstructorApproved: true, isEmailVerified: true } }
  );

  const instructor = await User.findOne({ email: 'instructor@test.com' });

  const freeCourse = await Course.create({
    title: 'Free Course',
    slug: 'free-course',
    description: 'A free test course',
    instructor: instructor._id,
    price: 0,
    isPublished: true,
  });
  courseId = freeCourse._id;

  const paidCourse = await Course.create({
    title: 'Paid Course',
    slug: 'paid-course',
    description: 'A paid test course',
    instructor: instructor._id,
    price: 29,
    isPublished: true,
  });
  paidCourseId = paidCourse._id;

  instructorToken = await registerAndLogin({
    name: 'Instructor 2',
    email: 'instructor2@test.com',
    password: 'Password123!',
    role: 'instructor',
  });

  studentToken = await registerAndLogin({
    name: 'Student',
    email: 'student@test.com',
    password: 'Password123!',
    role: 'student',
  });

  await User.updateOne(
    { email: 'student@test.com' },
    { $set: { isEmailVerified: true } }
  );
});

describe('Enrollment', () => {
  test('enrolls in a free course', async () => {
    const res = await request(app)
      .post(`/api/v1/enrollments/${courseId}/enroll`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({});

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('rejects paid course without payment payload', async () => {
    const res = await request(app)
      .post(`/api/v1/enrollments/${paidCourseId}/enroll`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({});

    expect(res.status).toBe(402);
    expect(res.body.code).toBe('PAYMENT_REQUIRED');
  });

  test('enrolls in a paid course with correct payment payload', async () => {
    const res = await request(app)
      .post(`/api/v1/enrollments/${paidCourseId}/enroll`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ paid: true, amount: 29 });

    expect(res.status).toBe(201);
    expect(res.body.data.paid).toBe(true);
    expect(res.body.data.paidAmount).toBe(29);
  });

  test('unenroll sets status to unenrolled', async () => {
    await request(app)
      .post(`/api/v1/enrollments/${courseId}/enroll`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({});

    const res = await request(app)
      .put(`/api/v1/enrollments/${courseId}/unenroll`)
      .set('Authorization', `Bearer ${studentToken}`);

    expect(res.status).toBe(200);
    const enrollment = await Enrollment.findOne({ course: courseId });
    expect(enrollment.status).toBe('unenrolled');
  });

  test('re-enroll after paying skips payment', async () => {
    await request(app)
      .post(`/api/v1/enrollments/${paidCourseId}/enroll`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ paid: true, amount: 29 });

    await request(app)
      .put(`/api/v1/enrollments/${paidCourseId}/unenroll`)
      .set('Authorization', `Bearer ${studentToken}`);

    const res = await request(app)
      .post(`/api/v1/enrollments/${paidCourseId}/enroll`)
      .set('Authorization', `Bearer ${studentToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('active');
  });
});