<script lang="ts">
  import { onMount } from 'svelte';
  import type { GrammarQuestion, CEFRLevel } from '$lib/types';
  import { topicGroups } from '$lib/admin/topicGroups';
  import { generateId, validateQuestion, blankQuestion } from '$lib/admin/questionUtils';
  import type { ReviewState } from '$lib/admin/reviewState';

  type DraftQuestion = GrammarQuestion & { _status?: 'added' | 'edited' | 'deleted' };

  let published = $state<GrammarQuestion[]>([]);
  let draft = $state<DraftQuestion[]>([]);
  let reviewed = $state<ReviewState['grammar']>({});
  let loading = $state(true);
  let publishing = $state(false);
  let savingReview = $state(false);
  let cooldown = $state(0);
  let loadError = $state<string | null>(null);
  let publishMessage = $state<string | null>(null);

  let filterTopic = $state('');
  let filterCefr = $state('');
  let filterType = $state('');
  let searchQuery = $state('');
  let showUnreviewedOnly = $state(false);

  let modal = $state<{ mode: 'add' | 'edit'; question: Partial<DraftQuestion> } | null>(null);
  let modalReviewed = $state(false);
  let tokensInput = $state('');

  const isDirty = $derived(draft.some((q) => q._status));
  const changeCount = $derived(draft.filter((q) => q._status).length);

  const reviewedCount = $derived(
    draft.filter((q) => q._status !== 'deleted' && reviewed[q.id]).length
  );
  const totalReviewable = $derived(draft.filter((q) => q._status !== 'deleted').length);

  // Every taxonomy topic, grouped by chapter in book order (the single source of truth).
  const TOPIC_GROUPS = topicGroups();
  const CEFR_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C'];
  const TYPES: GrammarQuestion['type'][] = [
    'fill',
    'order',
    'transform',
    'minimal-pair',
    'multiple-choice',
    'punctuation'
  ];

  const filtered = $derived(
    draft.filter((q) => {
      if (q._status === 'deleted') return false;
      if (filterTopic && q.topic !== filterTopic) return false;
      if (filterCefr && q.cefr !== filterCefr) return false;
      if (filterType && q.type !== filterType) return false;
      if (showUnreviewedOnly && reviewed[q.id]) return false;
      if (searchQuery) {
        const haystack = `${q.id} ${q.answer} ${q.sentence ?? ''} ${q.source ?? ''}`.toLowerCase();
        if (!haystack.includes(searchQuery.toLowerCase())) return false;
      }
      return true;
    })
  );

  // Also show deleted rows (at end) unless filtering to unreviewed
  const deletedRows = $derived(
    showUnreviewedOnly ? [] : draft.filter((q) => q._status === 'deleted')
  );

  onMount(load);

  async function load() {
    loading = true;
    loadError = null;
    try {
      const [questionsRes, reviewRes] = await Promise.all([
        fetch('/admin/grammar/api'),
        fetch('/admin/review-state/api')
      ]);
      if (!questionsRes.ok) throw new Error(`Failed to load questions: ${questionsRes.status}`);
      const data: GrammarQuestion[] = await questionsRes.json();
      published = data;
      draft = data.map((q) => ({ ...q }));

      if (reviewRes.ok) {
        const reviewData: ReviewState = await reviewRes.json();
        reviewed = reviewData.grammar ?? {};
      }
    } catch (e) {
      loadError = e instanceof Error ? e.message : String(e);
    } finally {
      loading = false;
    }
  }

  async function saveReviewState() {
    savingReview = true;
    try {
      const res = await fetch('/admin/review-state/api');
      const current: ReviewState = res.ok ? await res.json() : { grammar: {}, blog: {} };
      await fetch('/admin/review-state/api', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...current, grammar: reviewed })
      });
    } catch {
      // Silent fail — review state is best-effort
    } finally {
      savingReview = false;
    }
  }

  function beforeUnload(e: BeforeUnloadEvent) {
    if (isDirty) {
      e.preventDefault();
      e.returnValue = '';
    }
  }

  function openAdd() {
    const blank = blankQuestion();
    tokensInput = '';
    modalReviewed = false;
    modal = { mode: 'add', question: blank };
  }

  function openEdit(q: DraftQuestion) {
    modalReviewed = !!reviewed[q.id];
    tokensInput = '';
    modal = { mode: 'edit', question: { ...q } };
  }

  function closeModal() {
    modal = null;
  }

  function addChip(field: 'tokens' | 'words' | 'alternates' | 'options') {
    if (!modal) return;
    const value = tokensInput.trim();
    if (!value) return;
    const arr = (modal.question[field] as string[] | undefined) ?? [];
    modal.question = { ...modal.question, [field]: [...arr, value] };
    tokensInput = '';
  }

  function removeChip(field: 'tokens' | 'words' | 'alternates' | 'options', index: number) {
    if (!modal) return;
    const arr = (modal.question[field] as string[] | undefined) ?? [];
    modal.question = { ...modal.question, [field]: arr.filter((_, i) => i !== index) };
  }

  function addWordChip(value: string) {
    if (!modal) return;
    const arr = modal.question.words ?? [];
    modal.question = { ...modal.question, words: [...arr, value] };
  }

  function addAlternateChip(value: string) {
    if (!modal) return;
    const arr = modal.question.alternates ?? [];
    modal.question = { ...modal.question, alternates: [...arr, value] };
  }

  function saveModal() {
    if (!modal) return;
    const q = modal.question;

    if (modal.mode === 'add') {
      const id = q.id?.trim() || generateId(q.topic ?? 'ikke-placement', draft);
      const newQuestion: DraftQuestion = {
        ...(q as GrammarQuestion),
        id,
        _status: 'added'
      };
      const issues = validateQuestion(newQuestion);
      if (issues.length) {
        alert(issues.join('\n'));
        return;
      }
      draft = [...draft, newQuestion];
      // Apply reviewed state for newly added question
      applyModalReviewed(id);
    } else {
      const id = q.id!;
      const issues = validateQuestion(q);
      if (issues.length) {
        alert(issues.join('\n'));
        return;
      }
      draft = draft.map((existing) => {
        if (existing.id !== id) return existing;
        const wasOriginallyAdded = existing._status === 'added';
        return {
          ...(q as GrammarQuestion),
          _status: wasOriginallyAdded ? 'added' : 'edited'
        };
      });
      applyModalReviewed(id);
    }
    modal = null;
  }

  function applyModalReviewed(id: string) {
    const today = new Date().toISOString().slice(0, 10);
    const next = { ...reviewed };
    if (modalReviewed) {
      next[id] = { checkedAt: today };
    } else {
      delete next[id];
    }
    reviewed = next;
    saveReviewState();
  }

  function removeQuestion(q: DraftQuestion) {
    if (q._status === 'added') {
      draft = draft.filter((d) => d.id !== q.id);
      return;
    }
    if (!confirm(`Delete question ${q.id}? This will be removed on Publish.`)) return;
    draft = draft.map((d) => (d.id === q.id ? { ...d, _status: 'deleted' } : d));
  }

  function undelete(q: DraftQuestion) {
    draft = draft.map((d) => (d.id === q.id ? { ...d, _status: undefined } : d));
  }

  function discard() {
    if (!confirm('Discard all unpublished changes?')) return;
    draft = published.map((q) => ({ ...q }));
  }

  async function publish() {
    if (!isDirty || publishing || cooldown > 0) return;

    const toSend = draft.filter((q) => q._status !== 'deleted');
    for (const q of toSend) {
      const issues = validateQuestion(q);
      if (issues.length) {
        alert(`Question ${q.id}: ${issues.join('; ')}`);
        const found = draft.find((d) => d.id === q.id);
        if (found) openEdit(found);
        return;
      }
    }

    publishing = true;
    publishMessage = null;
    try {
      const res = await fetch('/admin/grammar/api', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft)
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Publish failed: ${res.status}`);
      }
      publishMessage = 'Published! Changes will be live in ~60 seconds.';
      const clean = draft
        .filter((q) => q._status !== 'deleted')
        .map((q) => {
          const copy = { ...q };
          delete copy._status;
          return copy as GrammarQuestion;
        });
      published = clean;
      draft = clean.map((q) => ({ ...q }));
      startCooldown();
    } catch (e) {
      publishMessage = e instanceof Error ? e.message : String(e);
    } finally {
      publishing = false;
    }
  }

  function startCooldown() {
    cooldown = 90;
    const interval = setInterval(() => {
      cooldown -= 1;
      if (cooldown <= 0) clearInterval(interval);
    }, 1000);
  }

  function fieldVisible(type: string | undefined, field: string): boolean {
    switch (field) {
      case 'sentence':
      case 'words':
        return type === 'fill';
      case 'tokens':
        return type === 'order';
      case 'source':
        return type === 'transform';
      case 'optionA':
      case 'optionB':
      case 'explanation':
        return type === 'minimal-pair';
      case 'options':
        return type === 'multiple-choice' || type === 'punctuation';
      default:
        return true;
    }
  }
</script>

<svelte:window onbeforeunload={beforeUnload} />

<svelte:head>
  <title>Grammar Admin — Norskeord</title>
</svelte:head>

<div class="mx-auto max-w-6xl px-4 py-10 text-left">
  <a href="/admin" class="text-sm text-blue-600 hover:underline dark:text-blue-400">&larr; Admin</a>
  <h1 class="mt-2">Grammar Questions</h1>

  {#if loading}
    <p class="mt-6 text-gray-600 dark:text-gray-300">Loading…</p>
  {:else if loadError}
    <p class="mt-6 text-red-600">Error: {loadError}</p>
  {:else}
    <!-- Toolbar -->
    <div class="mt-4 flex flex-wrap items-center gap-3">
      <!-- Review progress -->
      <span class="text-sm text-gray-600 dark:text-gray-300">
        Reviewed
        <span
          class={[
            'font-semibold',
            reviewedCount === totalReviewable && totalReviewable > 0
              ? 'text-green-600 dark:text-green-400'
              : 'text-gray-700 dark:text-gray-200'
          ].join(' ')}
        >
          {reviewedCount} / {totalReviewable}
        </span>
        {#if savingReview}
          <span class="ml-1 text-xs text-gray-400">saving…</span>
        {/if}
      </span>

      <div class="h-4 w-px bg-gray-200 dark:bg-gray-700"></div>

      {#if isDirty}
        <span class="text-sm font-medium text-amber-600 dark:text-amber-400">
          ● {changeCount} unpublished change{changeCount === 1 ? '' : 's'}
        </span>
      {:else}
        <span class="text-sm text-gray-400">No unpublished changes</span>
      {/if}

      <button
        class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-600 dark:hover:bg-gray-800"
        onclick={discard}
        disabled={!isDirty || publishing}
      >
        Discard
      </button>

      <button
        class="rounded bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        onclick={publish}
        disabled={!isDirty || publishing || cooldown > 0}
      >
        {#if publishing}
          Publishing…
        {:else if cooldown > 0}
          Publish ({cooldown}s)
        {:else}
          Publish ▶
        {/if}
      </button>

      <div class="ml-auto">
        <button
          class="rounded bg-green-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-green-700"
          onclick={openAdd}
        >
          + Add
        </button>
      </div>
    </div>

    {#if publishMessage}
      <p
        class="mt-2 text-sm"
        class:text-green-600={publishMessage.startsWith('Published')}
        class:text-red-600={!publishMessage.startsWith('Published')}
      >
        {publishMessage}
      </p>
    {/if}

    <!-- Filters -->
    <div class="mt-4 flex flex-wrap gap-2">
      <select
        bind:value={filterTopic}
        class="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
      >
        <option value="">All topics</option>
        {#each TOPIC_GROUPS as g (g.no)}
          <optgroup label={g.label}>
            {#each g.topics as t (t)}
              <option value={t}>{t}</option>
            {/each}
          </optgroup>
        {/each}
      </select>

      <select
        bind:value={filterCefr}
        class="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
      >
        <option value="">All CEFR</option>
        {#each CEFR_LEVELS as l (l)}
          <option value={l}>{l}</option>
        {/each}
      </select>

      <select
        bind:value={filterType}
        class="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
      >
        <option value="">All types</option>
        {#each TYPES as t (t)}
          <option value={t}>{t}</option>
        {/each}
      </select>

      <input
        type="text"
        placeholder="Search…"
        bind:value={searchQuery}
        class="rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
      />

      <label class="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
        <input type="checkbox" bind:checked={showUnreviewedOnly} class="rounded" />
        Unreviewed only
      </label>

      <span class="ml-auto self-center text-sm text-gray-600 dark:text-gray-300">
        {filtered.length} of {totalReviewable}
      </span>
    </div>

    <!-- Table -->
    <div class="mt-4 overflow-x-auto">
      <table class="w-full text-left text-sm">
        <thead>
          <tr
            class="border-b border-gray-200 text-gray-500 dark:border-gray-700 dark:text-gray-400"
          >
            <th class="py-2 pr-3 text-center" title="Reviewed">✓</th>
            <th class="py-2 pr-3">ID</th>
            <th class="py-2 pr-3">Topic</th>
            <th class="py-2 pr-3">CEFR</th>
            <th class="py-2 pr-3">Type</th>
            <th class="py-2 pr-3">Answer</th>
            <th class="py-2 pr-3">Status</th>
            <th class="py-2 pr-3"></th>
          </tr>
        </thead>
        <tbody>
          {#each filtered as q (q.id)}
            {@const isReviewed = !!reviewed[q.id]}
            <tr
              class={[
                'border-b border-gray-100 dark:border-gray-800',
                isReviewed ? 'bg-green-50 dark:bg-green-950/20' : ''
              ].join(' ')}
            >
              <td class="py-2 pr-3 text-center">
                <span
                  title={isReviewed ? `Reviewed ${reviewed[q.id].checkedAt}` : 'Not reviewed'}
                  class={[
                    'text-lg leading-none',
                    isReviewed ? 'text-green-500' : 'opacity-10'
                  ].join(' ')}
                >
                  ✓
                </span>
              </td>
              <td class="py-2 pr-3 font-mono text-xs">
                {q.id}
              </td>
              <td class="py-2 pr-3">{q.topic}</td>
              <td class="py-2 pr-3">{q.cefr}</td>
              <td class="py-2 pr-3">{q.type}</td>
              <td class="max-w-xs truncate py-2 pr-3" title={q.answer}>
                {q.answer}
              </td>
              <td class="py-2 pr-3">
                {#if q._status === 'added'}
                  <span
                    class="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700 dark:bg-green-900 dark:text-green-300"
                    >+ new</span
                  >
                {:else if q._status === 'edited'}
                  <span
                    class="rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:bg-amber-900 dark:text-amber-300"
                    >edited</span
                  >
                {/if}
              </td>
              <td class="py-2 pr-3 text-right whitespace-nowrap">
                <button class="mr-2 text-blue-600 hover:underline" onclick={() => openEdit(q)}
                  >✏</button
                >
                <button class="text-red-600 hover:underline" onclick={() => removeQuestion(q)}
                  >🗑</button
                >
              </td>
            </tr>
          {/each}

          <!-- Deleted rows at bottom -->
          {#each deletedRows as q (q.id)}
            <tr class="border-b border-gray-100 opacity-50 dark:border-gray-800">
              <td class="py-2 pr-3"></td>
              <td class="py-2 pr-3 font-mono text-xs line-through">{q.id}</td>
              <td class="py-2 pr-3 line-through">{q.topic}</td>
              <td class="py-2 pr-3 line-through">{q.cefr}</td>
              <td class="py-2 pr-3 line-through">{q.type}</td>
              <td class="max-w-xs truncate py-2 pr-3 line-through">{q.answer}</td>
              <td class="py-2 pr-3">
                <span
                  class="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700 dark:bg-red-900 dark:text-red-300"
                  >deleted</span
                >
              </td>
              <td class="py-2 pr-3 text-right">
                <button class="text-blue-600 hover:underline" onclick={() => undelete(q)}
                  >Undo</button
                >
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<!-- Question form modal -->
{#if modal}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
    <div
      class="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6 dark:bg-gray-900"
    >
      <h2>
        {modal.mode === 'add' ? 'Add question' : `Edit ${modal.question.id}`}
      </h2>

      <div class="mt-4 grid grid-cols-2 gap-3">
        {#if modal.mode === 'edit'}
          <label class="col-span-2 text-sm">
            <span class="block font-medium dark:text-gray-200">ID</span>
            <input
              type="text"
              value={modal.question.id}
              disabled
              class="mt-1 w-full rounded border border-gray-300 bg-gray-100 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-gray-400"
            />
          </label>
        {:else}
          <label class="col-span-2 text-sm">
            <span class="block font-medium dark:text-gray-200"
              >ID (leave blank to auto-generate)</span
            >
            <input
              type="text"
              bind:value={modal.question.id}
              placeholder="auto"
              class="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </label>
        {/if}

        <label class="text-sm">
          <span class="block font-medium dark:text-gray-200">Topic</span>
          <select
            bind:value={modal.question.topic}
            class="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            {#each TOPIC_GROUPS as g (g.no)}
              <optgroup label={g.label}>
                {#each g.topics as t (t)}
                  <option value={t}>{t}</option>
                {/each}
              </optgroup>
            {/each}
          </select>
        </label>

        <label class="text-sm">
          <span class="block font-medium dark:text-gray-200">CEFR</span>
          <select
            bind:value={modal.question.cefr}
            class="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            {#each CEFR_LEVELS as l (l)}
              <option value={l}>{l}</option>
            {/each}
          </select>
        </label>

        <label class="text-sm">
          <span class="block font-medium dark:text-gray-200">Type</span>
          <select
            bind:value={modal.question.type}
            class="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          >
            {#each TYPES as t (t)}
              <option value={t}>{t}</option>
            {/each}
          </select>
        </label>

        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" bind:checked={modal.question.plusOnly} class="mt-5" />
          <span class="mt-5 font-medium dark:text-gray-200">Plus only</span>
        </label>

        <label class="col-span-2 text-sm">
          <span class="block font-medium dark:text-gray-200">Prompt (optional)</span>
          <input
            type="text"
            bind:value={modal.question.prompt}
            class="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </label>

        {#if fieldVisible(modal.question.type, 'sentence')}
          <label class="col-span-2 text-sm">
            <span class="block font-medium dark:text-gray-200"
              >Sentence (use ___ for the blank)</span
            >
            <input
              type="text"
              bind:value={modal.question.sentence}
              class="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </label>
        {/if}

        {#if fieldVisible(modal.question.type, 'source')}
          <label class="col-span-2 text-sm">
            <span class="block font-medium dark:text-gray-200">Source</span>
            <input
              type="text"
              bind:value={modal.question.source}
              class="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </label>
        {/if}

        {#if fieldVisible(modal.question.type, 'words')}
          <div class="col-span-2 text-sm">
            <span class="block font-medium dark:text-gray-200">Words (word bank)</span>
            <div class="mt-1 flex flex-wrap gap-1">
              {#each modal.question.words ?? [] as word, i (i)}
                <span
                  class="flex items-center gap-1 rounded bg-gray-200 px-2 py-0.5 text-xs dark:bg-gray-700 dark:text-white"
                >
                  {word}
                  <button type="button" class="text-red-600" onclick={() => removeChip('words', i)}
                    >×</button
                  >
                </span>
              {/each}
            </div>
            <input
              type="text"
              placeholder="Type a word and press Enter"
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  const value = e.currentTarget.value.trim();
                  if (value) {
                    addWordChip(value);
                    e.currentTarget.value = '';
                  }
                }
              }}
              class="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
        {/if}

        {#if fieldVisible(modal.question.type, 'optionA')}
          <label class="text-sm">
            <span class="block font-medium dark:text-gray-200">Option A</span>
            <input
              type="text"
              bind:value={modal.question.optionA}
              class="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <label class="text-sm">
            <span class="block font-medium dark:text-gray-200">Option B</span>
            <input
              type="text"
              bind:value={modal.question.optionB}
              class="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </label>
          <label class="col-span-2 text-sm">
            <span class="block font-medium dark:text-gray-200">Explanation</span>
            <textarea
              bind:value={modal.question.explanation}
              rows="2"
              class="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            ></textarea>
          </label>
        {/if}

        {#if fieldVisible(modal.question.type, 'options')}
          <div class="col-span-2 text-sm">
            <span class="block font-medium dark:text-gray-200"
              >Options ({modal.question.type === 'punctuation' ? 'exactly 3' : '3 or 4'} — answer must
              match one exactly)</span
            >
            <div class="mt-1 flex flex-wrap gap-1">
              {#each modal.question.options ?? [] as option, i (i)}
                <span
                  class="flex items-center gap-1 rounded bg-gray-200 px-2 py-0.5 text-xs dark:bg-gray-700 dark:text-white"
                >
                  {option}
                  <button
                    type="button"
                    class="text-red-600"
                    onclick={() => removeChip('options', i)}>×</button
                  >
                </span>
              {/each}
            </div>
            <input
              type="text"
              placeholder="Type an option and press Enter"
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  const value = e.currentTarget.value.trim();
                  if (value) {
                    const arr = modal?.question.options ?? [];
                    if (modal) modal.question = { ...modal.question, options: [...arr, value] };
                    e.currentTarget.value = '';
                  }
                }
              }}
              class="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
        {/if}

        <label class="col-span-2 text-sm">
          <span class="block font-medium dark:text-gray-200">Answer</span>
          <input
            type="text"
            bind:value={modal.question.answer}
            class="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </label>

        {#if fieldVisible(modal.question.type, 'tokens')}
          <div class="col-span-2 text-sm">
            <span class="block font-medium dark:text-gray-200">Tokens</span>
            <div class="mt-1 flex flex-wrap gap-1">
              {#each modal.question.tokens ?? [] as token, i (i)}
                <span
                  class="flex items-center gap-1 rounded bg-gray-200 px-2 py-0.5 text-xs dark:bg-gray-700 dark:text-white"
                >
                  {token}
                  <button type="button" class="text-red-600" onclick={() => removeChip('tokens', i)}
                    >×</button
                  >
                </span>
              {/each}
            </div>
            <input
              type="text"
              bind:value={tokensInput}
              placeholder="Type a word and press Enter"
              onkeydown={(e) => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault();
                  addChip('tokens');
                }
              }}
              class="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            />
          </div>
        {/if}

        <div class="col-span-2 text-sm">
          <span class="block font-medium dark:text-gray-200">Alternates</span>
          <div class="mt-1 flex flex-wrap gap-1">
            {#each modal.question.alternates ?? [] as alt, i (i)}
              <span
                class="flex items-center gap-1 rounded bg-gray-200 px-2 py-0.5 text-xs dark:bg-gray-700 dark:text-white"
              >
                {alt}
                <button
                  type="button"
                  class="text-red-600"
                  onclick={() => removeChip('alternates', i)}>×</button
                >
              </span>
            {/each}
          </div>
          <input
            type="text"
            placeholder="Type an alternate answer and press Enter"
            onkeydown={(e) => {
              if (e.key === 'Enter' || e.key === ',') {
                e.preventDefault();
                const value = e.currentTarget.value.trim();
                if (value) {
                  addAlternateChip(value);
                  e.currentTarget.value = '';
                }
              }
            }}
            class="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </div>

        <label class="col-span-2 text-sm">
          <span class="block font-medium dark:text-gray-200">Hint (optional)</span>
          <input
            type="text"
            bind:value={modal.question.hint}
            class="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800 dark:text-white"
          />
        </label>
      </div>

      <div class="mt-6 flex items-center justify-between">
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" bind:checked={modalReviewed} class="rounded" />
          <span class="font-medium text-gray-700 dark:text-gray-200">Mark as reviewed</span>
        </label>
        <div class="flex gap-2">
          <button
            class="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
            onclick={closeModal}
          >
            Cancel
          </button>
          <button
            class="rounded bg-blue-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-700"
            onclick={saveModal}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}
