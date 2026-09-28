import { describe, test, expect } from '@jest/globals';
import { toSlug } from '../../src/utils/slugify.js';

describe('slugify', () => {
  test('converts simple titles', () => {
    expect(toSlug('React Fundamentals')).toBe('react-fundamentals');
  });

  test('strips special characters', () => {
    expect(toSlug('Hello, World!')).toBe('hello-world');
  });

  test('collapses multiple spaces', () => {
    expect(toSlug('A    B   C')).toBe('a-b-c');
  });
});