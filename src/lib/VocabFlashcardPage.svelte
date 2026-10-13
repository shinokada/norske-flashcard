<script lang="ts">
  import { getSessionLimit, resolveSessionLimit } from '$lib/session-limit';
  import { computeDuePool, dealChunk } from '$lib/due-deck';
  import { onMount, untrack } from 'svelte';
  import { browser } from '$app/environment';
  import { page } from '$app/state';
  import { supabase } from '$lib/supabase';
  import { Flashcard, ArrowLeft, ArrowRight } from '$lib';
  import SpeakButton from '$lib/SpeakButton.svelte';
  import type { VocabEntry, FlashcardLanguage, FSRSRating, CardProgress } from '$lib/types';
  import { LANGUAGES } from '$lib/config';
  import { getTranslation, getExampleTranslation } from '$lib/vocab-helpers';
  import { resolveTargetEntry, type DeckTarget } from '$lib/deck-target';
  import { spaceSiblings } from '$lib/sibling-spacing';
  import { siblingKey } from '$lib/quiz';
  import {
    saveProgress,
    loadProgressMap,
    loadProgressMapFromSupabase,
    previewIntervals,
    restoreProgressToLocalStorage,
    vocabKey,
    getFsrs
  } from '$lib/progress';
  import { countDueForPlan } from '$lib/due-count';
  import { State } from 'ts-fsrs';
  import { SvelteSet } from 'svelte/reactivity';
  import * as m from '$lib/paraglide/messages.js';

  interface CategoryNav {
    slug: string;
    label: string;
    href: string;
  }

  interface LockedNav {
    count: number;
    href: string;
  }

  interface Props {
    entries: VocabEntry[];
    language?: FlashcardLanguage;
    level?: string;
    sectionLabel?: string;
    prevCategory?: CategoryNav | null;
    nextCategory?: CategoryNav | null;
    nextLocked?: LockedNav | null;
  }

  let {
    entries,
    level = '',
    sectionLabel = '',
    prevCategory = null,
    nextCategory = null,
    nextLocked = null,
    language = 'english' as FlashcardLanguage
  }: Props = $props();

  type Mode = 'noreng' | 'engnor' | 'defnor';
  type CardType = 'word' | 'phrase';
  type DeckMode = 'all' | 'due';
  type DeckItem = { entry: VocabEntry; front: string; back: string };

  // ── 2-D: undo snapshot ──────────────────────────────────────────────────────
  interface UndoSnapshot {
    entry: VocabEntry;
    previousProgress: CardProgress | null; // null = card had never been rated
    previousMap: Record<string, CardProgress>;
    previousIndex: number;
    timer: ReturnType<typeof setInterval>;
    countdown: number;
  }

  const LS_MODE = 'vocab-flashcard-mode';
  const LS_CARD_TYPE = 'vocab-flashcard-card-type';
  const LS_SHOW_EXAMPLE = 'vocab-flashcard-show-example';
  const LS_DECK_MODE = 'vocab-flashcard-deck-mode';
  const LS_HAS_FLIPPED = 'vocab-flashcard-has-flipped';

  function getInitialMode(): Mode {
    if (!browser) return 'noreng';
    const saved = localStorage.getItem(LS_MODE);
    return saved === 'noreng' || saved === 'engnor' || saved === 'defnor' ? saved : 'noreng';
  }

  function getInitialCardType(): CardType {
    if (!browser) return 'word';
    const saved = localStorage.getItem(LS_CARD_TYPE);
    return saved === 'word' || saved === 'phrase' ? saved : 'word';
  }

  function getInitialShowExample(): boolean {
    if (!browser) return false;
    // Layout server exposes showExample directly for logged-in users (cross-device).
    if (page.data.user) return (page.data.showExample as boolean) ?? false;
    return localStorage.getItem(LS_SHOW_EXAMPLE) === 'true';
  }

  function getInitialDeckMode(): DeckMode {
    if (!browser) return 'all';
    const saved = localStorage.getItem(LS_DECK_MODE);
    return saved === 'due' ? 'due' : 'all';
  }

  let mode = $state<Mode>(getInitialMode());
  let cardType = $state<CardType>(getInitialCardType());
  let deckMode = $state<DeckMode>(getInitialDeckMode());
  let showExampleDefault = $state(getInitialShowExample());
  let showCardBack = $state(false);
  let showExampleEnglish = $state(getInitialShowExample());
  let deck = $state<DeckItem[]>([]);
  let currentIndex = $state(0);
  let completed = $state(false);
  let speakButtonRef = $state<SpeakButton | undefined>(undefined);
  let speakExampleRef = $state<SpeakButton | undefined>(undefined);
  let progressMap = $state<Record<string, CardProgress>>({});
  let dueCount = $state(0);

  // 2-B: track new-card count for this session
  let sessionNewCardCount = $state(0);

  // Fix 1 (due-only-review-update.md): the fixed due batch for this visit —
  // computed once when a genuinely new session starts (entries/mode/deckMode
  // change), then dealt out in sessionLimit-sized chunks and reshuffled once
  // exhausted, so Restart loops the same batch instead of shrinking to empty.
  let dueSessionPool = $state<VocabEntry[]>([]);
  let dueDealIndex = $state(0);
  // vocabKeys already saved via saveProgress() this visit — later encounters
  // of the same card (after the pool loops) are practice-only: same UI, but
  // the rating isn't persisted, so FSRS scheduling isn't touched twice.
  let ratedThisVisit = new SvelteSet<string>();

  // 2-D: undo state
  let undoSnapshot = $state<UndoSnapshot | null>(null);
  let undoCountdown = $state(0);

  // localStorage fallback — read synchronously at init (browser only), kept reactive for storage events
  let localSessionLimit = $state<number | null>(browser ? getSessionLimit(localStorage) : 20);

  // touch
  let isTouch = $state(false);
  let touchStartX = 0;

  // Has this device flipped a card before? Starts true so SSR / returning users get no
  // wiggle; onMount reads the real value. Drives the one-time wiggle + softened hint.
  let hasFlipped = $state(true);

  // Whether any entry in the current category has a definition — gates the defnor cycle
  let hasDefinitions = $derived(entries.some((e) => !!e.definition));

  // Effective mode: fall back to noreng if the category has no definitions.
  let effectiveMode = $derived<Mode>(mode === 'defnor' && !hasDefinitions ? 'noreng' : mode);

  // 3-A: plan from layout server data
  let plan = $derived(page.data.plan as 'free' | 'plus');
  let isPlus = $derived(plan === 'plus');
  let isGuest = $derived(page.data.user === null);

  // Session limit from the layout server data (cross-device): a number, null = All cards,
  // or undefined for guests / no profile row, who use this device's localStorage value.
  let profileSessionLimit = $derived(page.data.sessionLimit as number | null | undefined);

  // show_example from layout server (cross-device default)
  let showExample = $derived((page.data.showExample as boolean) ?? false);

  // FSRS review-intensity preset from layout server (0.8/0.9/0.95, or null for
  // default Standard). Only meaningful for Plus users — saveProgress() ignores it
  // when userId is null.
  let fsrsRetention = $derived((page.data.fsrsRetention as number | null | undefined) ?? null);

  // FSRS instance for the interval preview, so previewIntervals() matches what
  // saveProgress() will actually schedule (the preset applies to Plus users only).
  let fsrsInstance = $derived(getFsrs(isPlus ? fsrsRetention : null));

  // session limit — a profile value (including null = All cards) always wins; localStorage is the
  // fallback for guests and users with no profile row.
  // Uses $derived so it stays in sync if the prop changes (e.g. navigation).
  let sessionLimit = $derived(resolveSessionLimit(profileSessionLimit, localSessionLimit));

  onMount(() => {
    isTouch = window.matchMedia('(pointer: coarse)').matches;
    try {
      hasFlipped = localStorage.getItem(LS_HAS_FLIPPED) === 'true';
    } catch {
      // storage blocked — treat as already flipped (no wiggle)
    }

    // Plus users: load progress from Supabase (single source of truth).
    // Guest/free users: load from localStorage (async — may fetch the
    // id-migration-map.json fallback for stale pre-migration vocab ids).
    if (isPlus && page.data.user?.id) {
      loadProgressMapFromSupabase(page.data.user.id).then((map) => {
        progressMap = map;
        dueCount = countDueForPlan(map, isPlus);
      });
    } else {
      loadProgressMap().then((map) => {
        progressMap = map;
        dueCount = countDueForPlan(map, isPlus);
      });
    }

    // Seed showExampleDefault from the layout server value for logged-in users,
    // so it syncs across devices. localStorage remains the fallback for guests.
    if (page.data.user) {
      showExampleDefault = showExample;
      showExampleEnglish = showExample;
      localStorage.setItem(LS_SHOW_EXAMPLE, String(showExample));
    }

    // Keep localSessionLimit in sync if the user updates it in another tab
    // (only matters when there is no profile value: guests and users with no profile row)
    function onStorageChange(e: StorageEvent) {
      if (e.key === 'vocab-flashcard-session-limit' && profileSessionLimit === undefined) {
        localSessionLimit = getSessionLimit(localStorage);
      }
    }
    window.addEventListener('storage', onStorageChange);

    // 3-A: Plus users are always in due mode
    if (isPlus) {
      deckMode = 'due';
      localStorage.setItem(LS_DECK_MODE, 'due');
    } else if (deckMode === 'due') {
      deckMode = 'all';
      localStorage.setItem(LS_DECK_MODE, 'all');
    }

    return () => window.removeEventListener('storage', onStorageChange);
  });

  // ── Deck building ────────────────────────────────────────────────────────────

  function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function makeDeckItem(entry: VocabEntry, mo: Mode, ct: CardType): DeckItem {
    if (ct === 'phrase') {
      const translation = getExampleTranslation(entry, language) ?? entry.example_english;
      return {
        entry,
        front: mo === 'noreng' ? entry.example : translation,
        back: mo === 'noreng' ? translation : entry.example
      };
    }
    if (mo === 'defnor') {
      return {
        entry,
        front: entry.definition ?? getTranslation(entry, language),
        back: entry.norsk
      };
    }
    const translation = getTranslation(entry, language);
    return {
      entry,
      front: mo === 'noreng' ? entry.norsk : translation,
      back: mo === 'noreng' ? translation : entry.norsk
    };
  }

  /** Fix 1 (replaces the old 2-B `buildDueDeck`): the fixed pool of
   * due+new cards for this visit, plus the chunk-dealing that lets
   * `restart()` loop the same batch instead of shrinking toward empty.
   * Extracted to `$lib/due-deck.ts` (pure functions, unit tested in
   * `due-deck.test.ts`) — this component only owns the `$state` (the pool
   * and deal index) and calls them as plain functions on that state. */

  function buildDeck(
    es: VocabEntry[],
    mo: Mode,
    ct: CardType,
    dm: DeckMode,
    limit: number | null,
    target: DeckTarget | null = null,
    isRestart = false
  ) {
    const source = mo === 'defnor' ? es.filter((e) => !!e.definition) : es;
    const targetEntry = target ? resolveTargetEntry(source, target) : undefined;

    let items: DeckItem[];
    if (targetEntry) {
      // Jumped in from search: put the searched word first, then fill the
      // rest of the deck as usual (shuffled, session-limit aware) — bypasses
      // due-mode filtering so the word is guaranteed to show even if it
      // isn't due yet, since the person explicitly asked to see it.
      const rest = source.filter((e) => e !== targetEntry);
      const shuffledRest = shuffle(rest);
      const restLimit = limit != null ? Math.max(limit - 1, 0) : shuffledRest.length;
      // The searched word stays first and its sibling may follow it (seeing both
      // senses is useful); only the rest of the deck is spaced.
      items = [
        makeDeckItem(targetEntry, mo, ct),
        ...spaceSiblings(shuffledRest.slice(0, restLimit), siblingKey).map((e) =>
          makeDeckItem(e, mo, ct)
        )
      ];
    } else if (dm === 'due') {
      // Fix 1: fresh session (not a restart) recomputes the fixed pool and
      // clears this visit's rated-set; a restart just deals the next chunk
      // (reshuffling on wrap) from the pool already established this visit.
      // `source` is already mode-filtered (defnor excludes entries with no
      // `definition`), so computeDuePool needs no filtering of its own. The
      // session limit also caps the never-seen cards in the pool (null = All).
      if (!isRestart) {
        dueSessionPool = shuffle(computeDuePool(source, progressMap, new Date(), limit));
        dueDealIndex = 0;
        ratedThisVisit = new SvelteSet();
      }
      const dealt = dealChunk(dueSessionPool, dueDealIndex, limit);
      dueSessionPool = dealt.pool;
      dueDealIndex = dealt.dealIndex;
      items = spaceSiblings(dealt.chunk, siblingKey).map((e) => makeDeckItem(e, mo, ct));
    } else {
      items = spaceSiblings(shuffle(source).slice(0, limit ?? source.length), siblingKey).map((e) =>
        makeDeckItem(e, mo, ct)
      );
    }

    deck = items;
    currentIndex = 0;
    completed = false;
    showCardBack = false;
    showExampleEnglish = showExampleDefault;
    sessionNewCardCount = 0;
    clearUndo();
  }

  function resetCardState() {
    showCardBack = false;
    showExampleEnglish = showExampleDefault;
  }

  function restart() {
    buildDeck(entries, mode, cardType, deckMode, sessionLimit, null, true);
  }

  // Fix 1: cards left in this visit's due pool that haven't been rated yet —
  // drives the completion-screen message instead of the app-wide dueCount,
  // since the pool now loops rather than ever truly emptying.
  let sessionUnseenRemaining = $derived(
    deckMode === 'due' ? dueSessionPool.filter((e) => !ratedThisVisit.has(vocabKey(e))).length : 0
  );

  function setMode(mo: Mode) {
    if (mo === mode) return;
    mode = mo;
    // defnor only makes sense with Word cards — force it
    if (mo === 'defnor' && cardType !== 'word') {
      cardType = 'word';
      localStorage.setItem(LS_CARD_TYPE, 'word');
    }
    localStorage.setItem(LS_MODE, mo);
  }

  function setCardType(ct: CardType) {
    if (ct === cardType) return;
    cardType = ct;
    localStorage.setItem(LS_CARD_TYPE, ct);
  }

  // ── Navigation ───────────────────────────────────────────────────────────────

  function prev() {
    if (completed) {
      completed = false;
      return;
    }
    if (currentIndex > 0) {
      currentIndex--;
      resetCardState();
    }
  }

  function next() {
    if (completed || deck.length === 0) return;
    if (currentIndex < deck.length - 1) {
      currentIndex++;
      resetCardState();
    } else {
      completed = true;
    }
  }

  function toggleBack() {
    showCardBack = !showCardBack;
    if (!hasFlipped) {
      hasFlipped = true;
      try {
        localStorage.setItem(LS_HAS_FLIPPED, 'true');
      } catch {
        // storage blocked — wiggle may replay next visit, harmless
      }
    }
  }

  let current = $derived(deck[currentIndex]);

  // The sense gloss only helps where the card front is the bare Norwegian word
  // (NO → translation, word cards). In the other directions the front is already
  // sense-specific (a translation, a definition, or an example sentence).
  let currentFrontTag = $derived(
    current && effectiveMode === 'noreng' && cardType === 'word' ? current.entry.sense : undefined
  );

  function deriveExample(entry: VocabEntry, mo: Mode, ct: CardType): string {
    if (ct === 'phrase') return mo === 'noreng' ? entry.norsk : getTranslation(entry, language);
    return mo === 'noreng' ? entry.example : entry.example_english;
  }

  function deriveExampleTranslation(entry: VocabEntry, mo: Mode, ct: CardType): string {
    if (ct === 'phrase') return mo === 'noreng' ? getTranslation(entry, language) : entry.norsk;
    return mo === 'noreng'
      ? (getExampleTranslation(entry, language) ?? entry.example_english)
      : entry.example;
  }

  let currentExample = $derived(
    current ? deriveExample(current.entry, effectiveMode, cardType) : ''
  );

  let currentExampleTranslation = $derived(
    current ? deriveExampleTranslation(current.entry, effectiveMode, cardType) : ''
  );
  // Always the Norwegian text for TTS — regardless of card direction.
  let currentExampleNorsk = $derived(
    current
      ? cardType === 'phrase'
        ? (current.entry.lemma ?? current.entry.norsk)
        : current.entry.example
      : ''
  );

  // ── 2-C: interval preview ────────────────────────────────────────────────────

  let intervals = $derived.by(() => {
    if (!current || !showCardBack) return null;
    return previewIntervals(progressMap[vocabKey(current.entry)] ?? null, new Date(), fsrsInstance);
  });

  // ── 2-B: requeue "Again" cards in due mode ───────────────────────────────────

  /**
   * When a card is rated "again" in due mode, push a fresh copy to the end
   * of the deck so the user sees it again this session.
   */
  function requeueCard(item: DeckItem) {
    deck = [...deck, { ...item }];
  }

  // ── 2-D: undo helpers ────────────────────────────────────────────────────────

  function clearUndo() {
    if (undoSnapshot) {
      clearInterval(undoSnapshot.timer);
      undoSnapshot = null;
    }
    undoCountdown = 0;
  }

  function startUndoTimer(snapshot: Omit<UndoSnapshot, 'timer' | 'countdown'>) {
    clearUndo();
    let seconds = 5;
    undoCountdown = seconds;
    const timer = setInterval(() => {
      seconds--;
      undoCountdown = seconds;
      if (seconds <= 0) clearUndo();
    }, 1000);
    undoSnapshot = { ...snapshot, timer, countdown: seconds };
  }

  async function undo() {
    if (!undoSnapshot) return;
    const { entry, previousProgress, previousMap, previousIndex } = undoSnapshot;
    clearUndo();

    if (isPlus && page.data.user?.id) {
      // Plus: restore via Supabase
      const userId = page.data.user.id;
      if (previousProgress === null) {
        // Card had never been rated — delete the row
        const { error } = await supabase
          .from('card_progress')
          .delete()
          .eq('user_id', userId)
          .eq('vocab_id', vocabKey(entry));
        if (error) {
          console.error('undo: delete failed', error);
        }
      } else {
        // Re-upsert with the previous state
        progressMap = await saveProgress(
          entry,
          previousProgress.lastRating ?? 'good',
          previousMap,
          userId,
          fsrsRetention
        );
      }
    } else {
      // Guest / free: restore via localStorage
      restoreProgressToLocalStorage(entry, previousProgress);
    }

    progressMap = previousMap;
    dueCount = countDueForPlan(previousMap, isPlus);
    currentIndex = previousIndex;
    resetCardState();
    completed = false;
  }

  // ── Rebuild deck when entries / mode / cardType / deckMode changes ───────────

  // Word to jump straight to in the deck, e.g. arriving from a search result
  // (?id=<w-NNNNNN>&word=<norsk>). `id` identifies the exact sense; `word` is the
  // fallback for old links without an id (see resolveTargetEntry). Read
  // reactively from the URL, so restart() (which calls buildDeck without a
  // target) naturally reverts to a full shuffle, and a fresh search navigation
  // with new params rebuilds the deck again.
  let targetWord = $derived(page.url.searchParams.get('word'));
  let targetId = $derived(page.url.searchParams.get('id'));

  $effect(() => {
    const e = entries;
    // Read effectiveMode so the effect re-runs when mode or hasDefinitions changes.
    // Also read entries directly (above) so it re-runs on category navigation.
    const mo = effectiveMode;
    const ct = cardType;
    const dm = deckMode;
    const lim = sessionLimit;
    const target: DeckTarget = { id: targetId, word: targetWord };
    untrack(() => {
      if (e.length === 0) {
        deck = [];
        currentIndex = 0;
        completed = false;
        resetCardState();
        clearUndo();
        return;
      }
      buildDeck(e, mo, ct, dm, lim, target);
    });
  });

  // ── Input handlers ────────────────────────────────────────────────────────────

  function handleTouchStart(e: TouchEvent) {
    touchStartX = e.changedTouches[0].screenX;
  }

  function handleTouchEnd(e: TouchEvent) {
    const dx = e.changedTouches[0].screenX - touchStartX;
    if (dx < -30) next();
    else if (dx > 30) prev();
  }

  function handleKeyDown(e: KeyboardEvent) {
    const target = e.target as HTMLElement | null;
    if (
      !target ||
      target.closest('button, a, input, textarea, select, summary') ||
      target.isContentEditable
    )
      return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      prev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      next();
    } else if (!completed && current && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      toggleBack();
    } else if (!completed && current && (e.key === ' ' || e.key === 'Enter')) {
      e.preventDefault();
      toggleBack();
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      restart();
    } else if (!completed && current && (e.key === 'e' || e.key === 'E')) {
      e.preventDefault();
      showExampleEnglish = !showExampleEnglish;
      showExampleDefault = showExampleEnglish;
      localStorage.setItem(LS_SHOW_EXAMPLE, String(showExampleEnglish));
    } else if (!completed && current && e.key === '/') {
      e.preventDefault();
      speakButtonRef?.speak();
    } else if (!completed && current && e.key === '.') {
      e.preventDefault();
      speakExampleRef?.speak();
    } else if (!completed && current && e.key === '1') {
      e.preventDefault();
      rate('again');
    } else if (!completed && current && e.key === '2') {
      e.preventDefault();
      rate('hard');
    } else if (!completed && current && e.key === '3') {
      e.preventDefault();
      rate('good');
    } else if (!completed && current && e.key === '4') {
      e.preventDefault();
      rate('easy');
    } else if (e.key === 'z' || e.key === 'Z') {
      e.preventDefault();
      undo();
    }
  }

  // ── Rating ───────────────────────────────────────────────────────────────────

  async function rate(rating: FSRSRating) {
    if (!current) return;

    const entry = current.entry;
    const key = vocabKey(entry);

    // Fix 1: repeat encounter of a card already rated this visit (deck looped
    // after Restart) — practice-only. Same interaction, but skip saveProgress
    // so FSRS scheduling/undo aren't touched by a non-genuine second rating.
    if (deckMode === 'due' && ratedThisVisit.has(key)) {
      if (rating === 'again') requeueCard(current);
      next();
      return;
    }

    const previousProgress = progressMap[key] ?? null;
    const previousMap = { ...progressMap };
    const previousIndex = currentIndex;

    // Track new cards for 2-B session cap
    const isNew = previousProgress === null || previousProgress.fsrs.state === State.New;
    if (isNew) sessionNewCardCount++;

    // 3-A: only pass userId for Plus users (free users get localStorage only)
    const userId = isPlus ? (page.data.user?.id ?? null) : null;

    // Arm undo before the await so the snapshot is taken at the right moment
    startUndoTimer({ entry, previousProgress, previousMap, previousIndex });

    // 2-B: requeue "again" cards in due mode (before await so deck updates immediately)
    if (rating === 'again' && deckMode === 'due') {
      requeueCard(current);
    }

    next();

    progressMap = await saveProgress(entry, rating, progressMap, userId, fsrsRetention);
    dueCount = countDueForPlan(progressMap, isPlus);
    if (deckMode === 'due') {
      ratedThisVisit.add(key);
    }
  }

  // ── Interval label helpers ──────────────────────────────────────────────────

  // ── Interval inline label ────────────────────────────────────────────────────

  function intervalLabel(raw: string | undefined, rating: FSRSRating): string {
    if (rating === 'again') return 'review again';
    if (!raw) return '';
    const match = raw.match(/^(\d+)([smhd])$/);
    if (!match) return raw;
    const n = parseInt(match[1], 10);
    const unit = match[2];
    if (unit === 's') return `in ${n === 1 ? '1 second' : `${n} seconds`}`;
    if (unit === 'm') return `in ${n === 1 ? '1 minute' : `${n} minutes`}`;
    if (unit === 'h') return `in ${n === 1 ? '1 hour' : `${n} hours`}`;
    if (unit === 'd') return `in ${n === 1 ? '1 day' : `${n} days`}`;
    return raw;
  }

  // ── Button styles ─────────────────────────────────────────────────────────────

  // Segmented control helpers
  function segmentCls(active: boolean, color: 'green' | 'blue') {
    const base =
      'flex-1 px-3 py-2 text-sm font-medium whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-inset transition-colors';
    if (color === 'green') {
      return active
        ? `${base} bg-green-700 text-white dark:bg-green-600`
        : `${base} bg-white text-green-700 hover:bg-green-50 dark:bg-gray-800 dark:text-green-400 dark:hover:bg-gray-700`;
    }
    return active
      ? `${base} bg-blue-700 text-white dark:bg-blue-600`
      : `${base} bg-white text-blue-700 hover:bg-blue-50 dark:bg-gray-800 dark:text-blue-400 dark:hover:bg-gray-700`;
  }
</script>

<div class="flex w-full flex-col items-center">
  <!-- Category header: level label + i18n section name (e.g. "B1 · Vocabulary"). -->
  <div class="mt-10 mb-0.5 flex w-full items-center justify-center px-2">
    <h1 class="mb-0 text-center leading-tight">
      {#if level}<span class="mr-1">{level} ·</span>{/if}{sectionLabel}
    </h1>
  </div>

  <!-- Prev / Next category navigation -->
  <div class="mb-1 flex w-full items-center justify-between gap-2 px-2">
    <!-- Prev category -->
    <div class="flex min-w-0 flex-1 items-center">
      {#if prevCategory}
        <a
          href={prevCategory.href}
          class="inline-flex min-h-11 items-center gap-1 truncate rounded-lg px-2 py-2 text-sm text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          title={prevCategory.label}
        >
          <span class="shrink-0">←</span>
          <span class="truncate">{prevCategory.label}</span>
        </a>
      {/if}
    </div>

    <!-- Next category -->
    <div class="flex min-w-0 flex-1 items-center justify-end">
      {#if nextCategory}
        <a
          href={nextCategory.href}
          class="inline-flex min-h-11 items-center gap-1 truncate rounded-lg px-2 py-2 text-sm text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
          title={nextCategory.label}
        >
          <span class="truncate">{nextCategory.label}</span>
          <span class="shrink-0">→</span>
        </a>
      {:else if nextLocked}
        <a
          href={nextLocked.href}
          class="inline-flex min-h-11 items-center gap-1 truncate rounded-lg px-2 py-2 text-sm text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-200"
        >
          {m.quiz_plus_only_count({ count: nextLocked.count })}
        </a>
      {/if}
    </div>
  </div>

  <!-- Mode + CardType controls on one line -->
  <div class="mt-2 flex flex-wrap items-center justify-center gap-3">
    <!-- Mode segmented control -->
    <div
      class="inline-flex overflow-hidden rounded-lg border border-green-700 dark:border-green-600"
      role="group"
      aria-label="Card direction"
    >
      <button
        type="button"
        class={segmentCls(effectiveMode === 'noreng', 'green')}
        aria-pressed={effectiveMode === 'noreng'}
        onclick={() => setMode('noreng')}
      >
        NO → {LANGUAGES[language].abbr}
      </button>
      <button
        type="button"
        class="{segmentCls(
          effectiveMode === 'engnor',
          'green'
        )} border-l border-green-700 dark:border-green-600{hasDefinitions && cardType === 'word'
          ? ' border-r'
          : ''}"
        aria-pressed={effectiveMode === 'engnor'}
        onclick={() => setMode('engnor')}
      >
        {LANGUAGES[language].abbr} → NO
      </button>
      {#if hasDefinitions && cardType === 'word'}
        <button
          type="button"
          class={segmentCls(effectiveMode === 'defnor', 'green')}
          aria-pressed={effectiveMode === 'defnor'}
          onclick={() => setMode('defnor')}
        >
          {m.flashcard_definition()}
        </button>
      {/if}
    </div>

    <!-- CardType segmented control -->
    <div
      class="inline-flex overflow-hidden rounded-lg border border-blue-700 dark:border-blue-600"
      role="group"
      aria-label="Card type"
    >
      <button
        type="button"
        class={segmentCls(cardType === 'word', 'blue')}
        aria-pressed={cardType === 'word'}
        onclick={() => setCardType('word')}
      >
        {m.flashcard_word()}
      </button>
      <button
        type="button"
        class="{segmentCls(
          cardType === 'phrase',
          'blue'
        )} border-l border-blue-700 dark:border-blue-600"
        aria-pressed={cardType === 'phrase'}
        onclick={() => setCardType('phrase')}
      >
        {m.flashcard_phrase()}
      </button>
    </div>
  </div>

  <!-- 2-B / 3-A: deck mode toggle removed; Plus users always use due mode -->

  <!-- Link to profile preferences -->
  <a
    href="/my-profile"
    class="mt-1 text-xs text-gray-700 hover:text-gray-600 hover:underline dark:text-gray-300 dark:hover:text-gray-300"
  >
    {m.flashcard_change_defaults()}
  </a>

  <!-- 3-A: Plus upsell banner for free users (shown below controls) -->
  {#if !isPlus && dueCount > 0}
    <div
      class="mt-3 w-full max-w-lg rounded-xl border border-orange-200 bg-orange-50 py-4 dark:border-orange-800 dark:bg-orange-900/20"
    >
      <p class="font-semibold text-orange-700 dark:text-orange-300">
        {m.flashcard_plus_due_heading()}
      </p>
      <p class="mt-1 text-sm text-orange-600 dark:text-orange-400">
        {m.flashcard_plus_due_body()}
      </p>
      <a
        href="/plus"
        class="mt-2 inline-block text-sm font-semibold text-orange-700 hover:underline dark:text-orange-300"
      >
        {m.flashcard_plus_upgrade()}
      </a>
    </div>
  {/if}

  <!-- Counter row removed: counter merged into hint bar below -->
  {#if dueCount > 0 && deckMode === 'all'}
    <div class="mt-3 flex justify-center">
      <span
        class="inline-flex items-center rounded-full bg-orange-100 px-3 py-0.5 text-sm font-medium text-orange-800 dark:bg-orange-900 dark:text-orange-200"
      >
        {m.flashcard_due({ count: String(dueCount) })}
      </span>
    </div>
  {/if}

  <!-- 2-D: undo button removed from here; rendered near rating buttons to avoid layout shift -->

  <!-- Hint bar with counter on the right -->
  <div
    class="mt-3 flex w-full max-w-lg items-center justify-between rounded-md bg-gray-100 px-3 py-1 dark:bg-gray-800"
  >
    <p class="text-base text-gray-500 dark:text-gray-400">
      {#if isTouch}
        {m.flashcard_hint_touch()}
      {:else}
        {m.flashcard_hint_desktop_prefix()}
        {cardType === 'word' ? m.flashcard_hint_example_phrase() : m.flashcard_hint_word()}
      {/if}
    </p>
    <span
      class="ml-3 shrink-0 text-base font-medium text-gray-500 dark:text-gray-400"
      aria-label="Card {deck.length === 0
        ? 0
        : completed
          ? deck.length
          : currentIndex + 1} of {deck.length}"
    >
      {deck.length === 0 ? 0 : completed ? deck.length : currentIndex + 1}/{deck.length}
    </span>
  </div>

  <!-- Flashcard -->
  <div
    class="flip-box relative mt-2 min-h-96 w-full bg-transparent md:w-1/2"
    class:wiggle={!hasFlipped &&
      currentIndex === 0 &&
      !showCardBack &&
      !completed &&
      deck.length > 0}
  >
    {#if deck.length === 0 && mode !== 'defnor'}
      <div
        class="flex min-h-96 flex-col items-center justify-center gap-4 rounded-xl bg-gray-100 dark:bg-gray-800"
      >
        <p class="text-lg font-medium text-gray-700 dark:text-gray-300">
          {m.flashcard_no_items()}
        </p>
      </div>
    {:else if deck.length === 0 && mode === 'defnor'}
      <div
        class="flex min-h-96 flex-col items-center justify-center gap-4 rounded-xl bg-gray-100 dark:bg-gray-800"
      >
        <p class="text-lg font-medium text-gray-700 dark:text-gray-300">
          {m.flashcard_no_definitions_available()}
        </p>
      </div>
    {:else if completed}
      <div
        class="bg-custom-blue flex min-h-96 flex-col items-center justify-center gap-4 rounded-xl"
      >
        <p class="text-2xl font-semibold text-white">
          {m.flashcard_all_done({ count: String(deck.length) })}
        </p>

        <!-- Fix 1: restart deals the next sessionLimit-sized chunk from this
             visit's fixed due pool, reshuffling and looping once every card
             has been dealt — so "more due" reflects unseen-this-visit cards,
             not the app-wide due count, and the message flips to a practice
             prompt once the whole pool has been seen at least once. -->
        {#if deckMode === 'due' && sessionUnseenRemaining > 0}
          <p class="-mt-2 text-sm text-white/80">
            {sessionUnseenRemaining} more due — tap restart to keep going.
          </p>
        {:else if deckMode === 'due' && dueSessionPool.length > 0}
          <p class="-mt-2 text-sm text-white/80">
            All caught up — Shuffle &amp; Restart to keep practicing.
          </p>
        {/if}

        <!-- Guest post-session login nudge -->
        {#if isGuest}
          <div
            class="mx-4 rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-center backdrop-blur-sm"
          >
            <p class="text-sm font-semibold text-white">
              🎉 Great session! Log in to save your progress.
            </p>
            <p class="mt-0.5 text-xs text-white/70">
              Your ratings are stored on this device only — log in to keep them safe across devices.
            </p>
            <a
              href="/auth/login"
              class="mt-2 inline-block rounded-lg bg-white px-4 py-1.5 text-sm font-semibold text-blue-700 hover:bg-white/90"
            >
              Log in for free →
            </a>
          </div>
        {/if}

        <button
          type="button"
          onclick={restart}
          class="rounded-lg bg-blue-600 px-6 py-3 text-lg font-medium text-white hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 focus:outline-none"
        >
          {m.flashcard_shuffle_restart()}
        </button>
        <a
          href="/my-progress"
          class="text-sm text-white/80 underline hover:text-white hover:no-underline"
        >
          {m.flashcard_view_stats()}
        </a>
      </div>
    {:else}
      <div
        class="flip-box-inner"
        class:flip-it={showCardBack}
        onclick={toggleBack}
        onkeydown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            toggleBack();
          }
        }}
        ontouchstart={handleTouchStart}
        ontouchend={handleTouchEnd}
        tabindex="0"
        role="button"
        aria-pressed={showCardBack}
        aria-label={showCardBack
          ? 'Flashcard showing answer, press to show question'
          : 'Flashcard showing question, press to reveal answer'}
      >
        <Flashcard
          front={current?.front}
          back={current?.back}
          {showCardBack}
          frontTag={currentFrontTag}
          hint={isTouch ? m.flashcard_hint_touch() : m.flashcard_click_to_flip()}
          hintDimmed={hasFlipped}
          edgeInset
        />
      </div>
      <!-- Edge chevrons: hint that swiping navigates. Touch-only via CSS (pointer-coarse), and
           siblings of .flip-box-inner so they don't rotate with the card. Left is hidden on the
           first card; right stays on the last card (a swipe there completes the deck). -->
      {#if currentIndex > 0}
        <span
          aria-hidden="true"
          class="pointer-events-none absolute inset-y-0 left-1 z-10 hidden items-center text-white/70 pointer-coarse:flex"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="2"
            stroke="currentColor"
            class="h-7 w-7"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </span>
      {/if}
      <span
        aria-hidden="true"
        class="pointer-events-none absolute inset-y-0 right-1 z-10 hidden items-center text-white/70 pointer-coarse:flex"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="2"
          stroke="currentColor"
          class="h-7 w-7"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
        </svg>
      </span>
      <!-- aria-live region: announces card content to screen readers on flip/advance -->
      <div aria-live="polite" class="sr-only">
        {showCardBack
          ? current?.back
          : [current?.front, currentFrontTag].filter(Boolean).join(', ')}
      </div>
    {/if}
  </div>

  <!-- 2-B: new-card cap notice (the cap is the Cards per session setting; none for All cards) -->
  {#if deckMode === 'due' && sessionLimit !== null && sessionNewCardCount >= sessionLimit}
    <p class="mt-2 text-xs text-gray-700 dark:text-gray-300">
      {m.flashcard_new_limit()}
    </p>
  {/if}

  <!-- FSRS Rating buttons (visible after flip — free for all users) -->
  {#if !completed && current && showCardBack}
    {@const lastRating = progressMap[vocabKey(current.entry)]?.lastRating}
    {#if lastRating}
      {@const labelMap = { again: 'Again', hard: 'Hard', good: 'Good', easy: 'Easy' }}
      {@const colorMap = {
        again: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
        hard: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400',
        good: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
        easy: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
      }}
      <p class="mt-3 text-xs text-gray-700 dark:text-gray-300">
        Last: <span
          class="inline-block rounded-full px-2 py-0.5 text-xs font-medium {colorMap[lastRating]}"
          >{labelMap[lastRating]}</span
        >
      </p>
    {/if}
    <div class="mx-auto mt-4 grid w-full grid-cols-2 gap-2 md:w-1/2 md:grid-cols-4">
      <!-- Again -->
      <button
        type="button"
        onclick={() => rate('again')}
        class="flex w-full flex-col items-center justify-between rounded-lg bg-red-600 px-4 py-3 text-sm font-medium text-white hover:bg-red-700 focus:ring-4 focus:ring-red-300 focus:outline-none dark:bg-red-500 dark:hover:bg-red-600"
      >
        <span
          >{m.flashcard_again()}
          <kbd
            aria-hidden="true"
            class="ml-1 hidden rounded bg-red-800 px-1 text-xs opacity-70 min-[892px]:inline">1</kbd
          >
        </span>
        {#if intervals}<span class="mt-auto text-sm opacity-75"
            >{intervalLabel(intervals.again, 'again')}</span
          >{/if}
      </button>

      <!-- Hard -->
      <button
        type="button"
        onclick={() => rate('hard')}
        class="flex w-full flex-col items-center justify-between rounded-lg bg-orange-500 px-4 py-3 text-sm font-medium text-white hover:bg-orange-600 focus:ring-4 focus:ring-orange-300 focus:outline-none dark:bg-orange-400 dark:hover:bg-orange-500"
      >
        <span
          >{m.flashcard_hard()}
          <kbd
            aria-hidden="true"
            class="ml-1 hidden rounded bg-orange-700 px-1 text-xs opacity-70 min-[892px]:inline"
            >2</kbd
          >
        </span>
        {#if intervals}<span class="mt-auto text-sm opacity-75"
            >{intervalLabel(intervals.hard, 'hard')}</span
          >{/if}
      </button>

      <!-- Good -->
      <button
        type="button"
        onclick={() => rate('good')}
        class="flex w-full flex-col items-center justify-between rounded-lg bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700 focus:ring-4 focus:ring-green-300 focus:outline-none dark:bg-green-500 dark:hover:bg-green-600"
      >
        <span
          >{m.flashcard_good()}
          <kbd
            aria-hidden="true"
            class="ml-1 hidden rounded bg-green-800 px-1 text-xs opacity-70 min-[892px]:inline"
            >3</kbd
          >
        </span>
        {#if intervals}<span class="mt-auto text-sm opacity-75"
            >{intervalLabel(intervals.good, 'good')}</span
          >{/if}
      </button>

      <!-- Easy -->
      <button
        type="button"
        onclick={() => rate('easy')}
        class="flex w-full flex-col items-center justify-between rounded-lg bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 focus:outline-none dark:bg-blue-500 dark:hover:bg-blue-600"
      >
        <span
          >{m.flashcard_easy()}
          <kbd
            aria-hidden="true"
            class="ml-1 hidden rounded bg-blue-800 px-1 text-xs opacity-70 min-[892px]:inline"
            >4</kbd
          >
        </span>
        {#if intervals}<span class="mt-auto text-sm opacity-75"
            >{intervalLabel(intervals.easy, 'easy')}</span
          >{/if}
      </button>
    </div>
  {/if}

  <!-- Part of speech badge, Pronounce (word), and Undo -->
  {#if !completed && current}
    <!-- Pronounce + badge + Undo row -->
    <div class="mt-3 flex w-full max-w-lg items-center gap-2">
      {#if cardType !== 'phrase'}
        <span
          class="shrink-0 rounded-lg bg-indigo-700 px-3 py-3 text-sm font-medium text-white dark:bg-indigo-800/50 dark:text-indigo-200"
        >
          {current.entry.part === 'noun'
            ? m.part_noun()
            : current.entry.part === 'verb'
              ? m.part_verb()
              : current.entry.part === 'adjective'
                ? m.part_adjective()
                : current.entry.part === 'adverb'
                  ? m.part_adverb()
                  : current.entry.part === 'pronoun'
                    ? m.part_pronoun()
                    : current.entry.part === 'preposition'
                      ? m.part_preposition()
                      : current.entry.part === 'conjunction'
                        ? m.part_conjunction()
                        : current.entry.part === 'interjection'
                          ? m.part_interjection()
                          : m.part_phrase()}
        </span>
      {/if}
      <div class="flex-1">
        <SpeakButton
          bind:this={speakButtonRef}
          word={cardType === 'word'
            ? (current.entry.lemma ?? current.entry.norsk)
            : current.entry.example}
          variant="icon-lg"
          label="Pronounce"
        />
      </div>
      <button
        type="button"
        onclick={undo}
        disabled={!undoSnapshot}
        tabindex={undoSnapshot ? 0 : -1}
        class="inline-flex min-w-28 items-center justify-center rounded-lg px-3 py-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40 {undoSnapshot
          ? 'bg-amber-500 hover:bg-amber-600'
          : 'bg-indigo-700'}"
      >
        ↩ {undoSnapshot ? m.flashcard_undo_countdown({ seconds: String(undoCountdown) }) : 'Undo'}
      </button>
    </div>
  {/if}

  <!-- Example / Word section -->
  {#if !completed && current}
    <div
      class="mt-3 w-full max-w-lg rounded-lg border border-gray-200 bg-white pt-4 pb-3 dark:border-white/10 dark:bg-indigo-950/60"
    >
      <p class="px-5 text-base text-gray-700 italic dark:text-gray-300">
        {currentExample}
      </p>
      {#if currentExampleTranslation}
        <div class="mt-2">
          {#if showExampleEnglish}
            <p class="mb-2 px-5 text-sm text-gray-600 dark:text-gray-300">
              {currentExampleTranslation}
            </p>
          {/if}
          <div class="mx-3 mb-3 flex items-center gap-2">
            <span
              class="shrink-0 rounded-lg bg-indigo-700 px-3 py-2 text-sm font-medium text-white dark:bg-indigo-800/50 dark:text-indigo-200"
            >
              {cardType === 'word' ? m.flashcard_phrase() : m.flashcard_word()}
            </span>
            <div class="flex-1">
              <SpeakButton
                bind:this={speakExampleRef}
                word={currentExampleNorsk}
                variant="icon-row"
                label="Pronounce phrase"
              />
            </div>
            <button
              type="button"
              class="shrink-0 rounded-lg bg-indigo-700 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-600 dark:bg-indigo-800/50 dark:text-indigo-200 dark:hover:bg-indigo-700/50"
              onclick={() => {
                showExampleEnglish = !showExampleEnglish;
                showExampleDefault = showExampleEnglish;
                localStorage.setItem(LS_SHOW_EXAMPLE, String(showExampleEnglish));
              }}
            >
              {showExampleEnglish ? m.flashcard_hide() : m.flashcard_show()}
            </button>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Nav buttons -->
  <div class="grid w-full grid-cols-3 gap-2 pt-4">
    <button
      type="button"
      onclick={prev}
      aria-label={m.flashcard_previous()}
      class="inline-flex min-h-[44px] w-full items-center bg-indigo-700 p-3 text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50 sm:p-4 dark:bg-indigo-900/80 dark:hover:bg-indigo-800/80"
      disabled={currentIndex <= 0 && !completed}
    >
      <ArrowLeft class="mr-4" />
      {m.flashcard_previous()}
    </button>

    <button
      type="button"
      class="inline-flex min-h-[44px] w-full items-center justify-center bg-indigo-700 p-3 text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50 sm:p-4 dark:bg-indigo-900/80 dark:hover:bg-indigo-800/80"
      aria-label={m.flashcard_restart()}
      onclick={restart}
      disabled={entries.length === 0}
    >
      {m.flashcard_restart()}
    </button>

    <button
      type="button"
      onclick={next}
      aria-label={m.flashcard_next()}
      class="inline-flex min-h-[44px] w-full items-center bg-indigo-700 p-3 text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50 sm:p-4 dark:bg-indigo-900/80 dark:hover:bg-indigo-800/80"
      disabled={completed || deck.length === 0}
    >
      <ArrowRight class="mr-4" />
      {m.flashcard_next()}
    </button>
  </div>

  <!-- Guest persistent footer nudge (shown below nav, only for non-logged-in users) -->
  {#if isGuest}
    <div
      class="mt-6 w-full max-w-lg border-t border-gray-200 pt-4 text-center dark:border-gray-700"
    >
      <p class="text-xs text-gray-700 dark:text-gray-300">
        📌 Your progress is saved on this device only.
        <a
          href="/auth/login"
          class="font-medium text-indigo-500 hover:underline dark:text-indigo-400"
        >
          Log in for free
        </a>
        to keep it safe across devices.
      </p>
    </div>
  {/if}
</div>

<svelte:window onkeydown={handleKeyDown} />

<style>
  .flip-box {
    background-color: transparent;
    perspective: 1000px;
  }
  .flip-box-inner {
    position: relative;
    width: 100%;
    height: 384px;
    text-align: center;
    transition: transform 0.4s;
    transform-style: preserve-3d;
    cursor: pointer;
    user-select: none;
    touch-action: pan-y;
  }
  @media (prefers-reduced-motion: reduce) {
    .flip-box-inner {
      transition: none;
    }
  }
  .flip-it {
    transform: rotateY(180deg);
  }

  /* One-time attention wiggle on the first card until the user flips once.
     On the outer wrapper: .flip-box-inner already uses transform for the flip. */
  @keyframes flip-wiggle {
    0%,
    100% {
      transform: none;
    }
    20% {
      transform: translateX(-4px) rotate(-1.5deg);
    }
    40% {
      transform: translateX(4px) rotate(1.5deg);
    }
    60% {
      transform: translateX(-3px) rotate(-1deg);
    }
    80% {
      transform: translateX(3px) rotate(1deg);
    }
  }
  @media (prefers-reduced-motion: no-preference) {
    .flip-box.wiggle {
      animation: flip-wiggle 0.6s ease-in-out 0.8s 1;
    }
  }
</style>
