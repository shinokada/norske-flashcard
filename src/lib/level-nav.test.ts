import { describe, it, expect } from 'vitest';
import { adjacentLevels } from './level-nav';

describe('adjacentLevels', () => {
  it('has no prev at A1', () => {
    expect(adjacentLevels('a1')).toEqual({ prev: null, next: 'a2' });
  });

  it('has no next at C', () => {
    expect(adjacentLevels('c')).toEqual({ prev: 'b2', next: null });
  });

  it('returns both neighbours for a middle level', () => {
    expect(adjacentLevels('b1')).toEqual({ prev: 'a2', next: 'b2' });
  });

  it('is case-insensitive', () => {
    expect(adjacentLevels('B2')).toEqual({ prev: 'b1', next: 'c' });
  });

  it('returns no neighbours for an unknown level', () => {
    expect(adjacentLevels('c1')).toEqual({ prev: null, next: null });
  });
});
