import { describe, test, expect } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { generateAccessToken } from '../../src/utils/generateAccessToken.js';
import { generateRefreshToken } from '../../src/utils/generateRefreshToken.js';

describe('token generation', () => {
  test('access token contains the user id and expires in 15 minutes', () => {
    const token = generateAccessToken('user123');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    expect(decoded.id).toBe('user123');
    expect(decoded.exp - decoded.iat).toBe(15 * 60);
  });

  test('refresh token contains the user id and uses the refresh secret', () => {
    const token = generateRefreshToken('user456');
    const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

    expect(decoded.id).toBe('user456');
    expect(decoded.exp - decoded.iat).toBeGreaterThan(15 * 60);
  });
});