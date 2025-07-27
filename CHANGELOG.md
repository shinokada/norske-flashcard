# norske-flashcard

## 1.2.0

### Minor Changes

- feat: apply consistent UX improvements across all flashcard components
  - Add card counter display (e.g., "3/7") to all flashcard variants
  - Implement unified keyboard navigation: ←↑ previous, →↓ next, N for new card
  - Fix history management to preserve forward navigation without truncation
  - Add touch gesture support with swipe detection for mobile users
  - Update button layouts with proper disabled states and visual feedback
  - Separate navigation from card generation for clearer user experience
  - Add context-aware help text (different for touch vs keyboard users)
  - Maintain component-specific features (verb modes, explanation modes)

  Components updated:
  - FlashcardPage.svelte (Japanese with verb support)
  - FlashcardPage.svelte (Norske basic version)
  - FlashcardPageExtended.svelte (Norske with explanation mode)

  Breaking: Arrow keys no longer flip cards (use space/enter instead)

## 1.1.1

### Patch Changes

- feat(FlashcardPage/FlashcardPageExtended): improve UX by making flashcard clickable to flip
- Removed "flip" button (←) for flipping card
- Made the flashcard clickable to flip using mouse or keyboard (Enter/Space)
- Added keyboard accessibility with role="button" and tabindex="0"
- Updated instructions to reflect new interaction pattern
- Preserved support for arrow key shortcuts: ← (flip), → (next), ↑ (previous), ↓ (forward)

## 1.0.1

### Patch Changes

- docs: update about page ([`b513f25939b26c5d0b9df730d831e307b40b1e4d`](https://github.com/shinokada/norske-flashcard/commit/b513f25939b26c5d0b9df730d831e307b40b1e4d))
  chore: update dependencies
