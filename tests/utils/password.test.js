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

describe('User password hashing', () => {
  test('hashes the password on save', async () => {
    const user = new User({
      name: 'Test',
      email: 'hash@test.com',
      password: 'PlainPassword123!',
    });

    await user.save();

    expect(user.password).toBeDefined();
    expect(user.password).not.toBe('PlainPassword123!');
    expect(user.password.startsWith('$2')).toBe(true);
  });

  test('matchPassword returns true for the correct password', async () => {
    const user = new User({
      name: 'Test',
      email: 'match@test.com',
      password: 'PlainPassword123!',
    });
    await user.save();

    const ok = await user.matchPassword('PlainPassword123!');
    expect(ok).toBe(true);
  });

  test('matchPassword returns false for the wrong password', async () => {
    const user = new User({
      name: 'Test',
      email: 'wrong@test.com',
      password: 'PlainPassword123!',
    });
    await user.save();

    const ok = await user.matchPassword('DifferentPassword123!');
    expect(ok).toBe(false);
  });

  test('does not rehash the password if it is not modified', async () => {
    const user = new User({
      name: 'Test',
      email: 'rehash@test.com',
      password: 'PlainPassword123!',
    });
    await user.save();

    const originalHash = user.password;
    user.name = 'Renamed';
    await user.save();

    expect(user.password).toBe(originalHash);
  });
});