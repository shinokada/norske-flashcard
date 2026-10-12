import { describe, it, expect } from 'vitest';
import { isCacheExcluded } from './edge-cache';

describe('isCacheExcluded', () => {
  it.each([
    '/a1/greetings',
    '/a2/transport',
    '/b1/work',
    '/b2/work',
    '/c/uttrykk',
    '/c/interpersonal-conflict',
    '/A2/transport', // the route lower-cases the level, so this is the same page
    '/a1/uttrykk'
  ])('excludes level route %s', (path) => {
    expect(isCacheExcluded(path)).toBe(true);
  });

  it.each([
    '/api/search',
    '/api/plan',
    '/auth/login',
    '/auth/sync',
    '/learn/a1',
    '/daily/a/2026-10-12',
    '/daily/B/2025-06-01',
    '/daily/a/2026-10-12/__data.json',
    '/plus/success',
    '/grammar/chapter/x',
    '/quiz',
    '/quiz/a1/greetings',
    '/norskproven',
    '/my-progress',
    '/my-profile',
    '/blog'
  ])('excludes auth-sensitive path %s', (path) => {
    expect(isCacheExcluded(path)).toBe(true);
  });

  it.each(['/', '/plus', '/resources', '/blog/my-post', '/contact', '/cookies'])(
    'allows static page %s',
    (path) => {
      expect(isCacheExcluded(path)).toBe(false);
    }
  );

  it('does not match a path that merely starts with a level letter', () => {
    expect(isCacheExcluded('/contact')).toBe(false);
    expect(isCacheExcluded('/c')).toBe(false);
    expect(isCacheExcluded('/a1')).toBe(false);
  });
});
