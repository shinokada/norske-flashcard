import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import Flashcard from './Flashcard.svelte';

// jsdom does not run Tailwind, so `pointer-coarse:*` classes never take effect here. These tests
// check what is in the DOM (which strings render, aria-hidden, the size class picked); which label
// is *visible* on a touch device is a CSS matter and is covered by the e2e test instead.
// See ai-docs/implementation/flashcard-flip-hint-follow-up.md, Phase 4.

const HINT = 'Click to flip';
const HINT_TOUCH = 'Tap to flip · Swipe to navigate';

function frontP(container: HTMLElement) {
  return container.querySelectorAll('p')[0] as HTMLElement;
}

describe('Flashcard hint', () => {
  it('renders no hint when `hint` is not set', () => {
    render(Flashcard, { props: { front: 'hus', back: 'house' } });
    expect(screen.queryByText(HINT)).toBeNull();
  });

  it('renders the hint, hidden from assistive tech, when `hint` is set', () => {
    render(Flashcard, { props: { front: 'hus', back: 'house', hint: HINT } });
    const label = screen.getByText(HINT);
    expect(label.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  it('renders only the desktop string when `hintTouch` is not set', () => {
    render(Flashcard, { props: { front: 'hus', back: 'house', hint: HINT } });
    expect(screen.getByText(HINT).classList.contains('pointer-coarse:hidden')).toBe(false);
    expect(screen.queryByText(HINT_TOUCH)).toBeNull();
  });

  it('renders both strings when `hintTouch` is set, so CSS can pick one', () => {
    render(Flashcard, {
      props: { front: 'hus', back: 'house', hint: HINT, hintTouch: HINT_TOUCH }
    });
    expect(screen.getByText(HINT).classList.contains('pointer-coarse:hidden')).toBe(true);
    expect(screen.getByText(HINT_TOUCH).classList.contains('pointer-coarse:inline')).toBe(true);
  });

  it('softens the hint when `hintDimmed` is set', () => {
    render(Flashcard, { props: { front: 'hus', back: 'house', hint: HINT, hintDimmed: true } });
    expect(screen.getByText(HINT).closest('.text-white\\/80')).not.toBeNull();
  });
});

describe('Flashcard text size', () => {
  const cases: [number, string][] = [
    [40, 'text-3xl'],
    [41, 'text-2xl'],
    [80, 'text-2xl'],
    [81, 'text-xl'],
    [130, 'text-xl'],
    [131, 'text-lg']
  ];

  it.each(cases)('steps the size for a %i-character front to %s', (length, cls) => {
    const { container } = render(Flashcard, {
      props: { front: 'a'.repeat(length), back: 'x' }
    });
    expect(frontP(container).classList.contains(cls)).toBe(true);
  });

  it('does not count HTML tags toward the length', () => {
    const { container } = render(Flashcard, {
      props: { front: '<b>' + 'a'.repeat(40) + '</b>', back: 'x' }
    });
    expect(frontP(container).classList.contains('text-3xl')).toBe(true);
  });

  it('caps the front at 200 characters plus an ellipsis', () => {
    const { container } = render(Flashcard, { props: { front: 'a'.repeat(250), back: 'x' } });
    expect(frontP(container).textContent).toBe('a'.repeat(200) + '...');
  });
});

describe('Flashcard edge inset', () => {
  it('adds touch-only horizontal padding when `edgeInset` is set', () => {
    const { container } = render(Flashcard, {
      props: { front: 'hus', back: 'house', edgeInset: true }
    });
    expect(frontP(container).classList.contains('pointer-coarse:px-9')).toBe(true);
  });

  it('leaves the padding alone otherwise', () => {
    const { container } = render(Flashcard, { props: { front: 'hus', back: 'house' } });
    expect(frontP(container).classList.contains('pointer-coarse:px-9')).toBe(false);
  });
});
