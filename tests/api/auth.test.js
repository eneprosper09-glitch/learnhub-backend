import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import app from '../../src/app.js';
import User from '../../src/models/User.js';

let mongo;

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
});

describe('POST /api/v1/auth/register', () => {
  test('creates a user with valid data', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Test User',
      email: 'newuser@test.com',
      password: 'Password123!',
      role: 'student',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe('newuser@test.com');
    expect(res.body.data.role).toBe('student');
  });

  test('rejects weak passwords', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Test',
      email: 'weak@test.com',
      password: '12345678',
      role: 'student',
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  test('rejects duplicate email', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'First',
      email: 'dupe@test.com',
      password: 'Password123!',
      role: 'student',
    });

    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Second',
      email: 'dupe@test.com',
      password: 'Password123!',
      role: 'student',
    });

    expect(res.status).toBe(400);
  });

  test('rejects role admin', async () => {
    const res = await request(app).post('/api/v1/auth/register').send({
      name: 'Fake Admin',
      email: 'fakeadmin@test.com',
      password: 'Password123!',
      role: 'admin',
    });

    expect(res.status).toBe(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });
});

describe('POST /api/v1/auth/login', () => {
  beforeEach(async () => {
    await User.create({
      name: 'Login User',
      email: 'login@test.com',
      password: 'Password123!',
      role: 'student',
      isEmailVerified: true,
    });
  });

  test('logs in with valid credentials and returns access token', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'login@test.com', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.accessToken).toBeDefined();
    expect(res.headers['set-cookie']).toBeDefined();
  });

  test('rejects wrong password', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'login@test.com', password: 'WrongPassword123!' });

    expect(res.status).toBe(401);
    expect(res.body.code).toBe('AUTH_INVALID_CREDENTIALS');
  });

  test('locks account after 5 failed attempts', async () => {
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'login@test.com', password: 'WrongPassword123!' });
    }

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'login@test.com', password: 'WrongPassword123!' });

    expect(res.status).toBe(423);
    expect(res.body.code).toBe('AUTH_ACCOUNT_LOCKED');
  });
});

describe('GET /api/v1/auth/me', () => {
  test('returns 401 without a token', async () => {
    const res = await request(app).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  test('returns the current user with a valid token', async () => {
    await request(app).post('/api/v1/auth/register').send({
      name: 'Me Test',
      email: 'me@test.com',
      password: 'Password123!',
      role: 'student',
    });

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'me@test.com', password: 'Password123!' });

    const token = login.body.accessToken;

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('me@test.com');
  });
});