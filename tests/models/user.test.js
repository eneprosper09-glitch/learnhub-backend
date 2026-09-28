import { describe, test, expect, beforeAll, afterAll, beforeEach } from '@jest/globals';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
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

describe('User model', () => {
  test('requires email', async () => {
    const user = new User({ name: 'A', password: 'Password123!' });
    let err;
    try {
      await user.save();
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.errors.email).toBeDefined();
  });

  test('rejects invalid email', async () => {
    const user = new User({ name: 'A', email: 'not-an-email', password: 'Password123!' });
    let err;
    try {
      await user.save();
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.errors.email).toBeDefined();
  });

  test('rejects unknown role', async () => {
    const user = new User({
      name: 'A',
      email: 'a@test.com',
      password: 'Password123!',
      role: 'superuser',
    });
    let err;
    try {
      await user.save();
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.errors.role).toBeDefined();
  });

  test('accepts a student role by default', async () => {
    const user = await User.create({
      name: 'A',
      email: 'student@test.com',
      password: 'Password123!',
    });
    expect(user.role).toBe('student');
  });
});