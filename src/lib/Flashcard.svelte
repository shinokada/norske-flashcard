<script lang="ts">
  interface Props {
    front?: string;
    back?: string;
    showCardBack?: boolean;
    pFront?: string;
    pBack?: string;
    /** Small gloss shown under the front text (e.g. a vocab `sense`). */
    frontTag?: string;
    /** Small "Click to flip" label at the bottom of the front face (decorative; aria-hidden). */
    hint?: string;
    /** Label for touch devices. When set, both strings render and CSS (pointer-coarse) picks one. */
    hintTouch?: string;
    /** Soften the hint once the user has flipped a card before. */
    hintDimmed?: boolean;
    /** Reserve horizontal room for the edge chevrons on touch devices (CSS-only: pointer-coarse). */
    edgeInset?: boolean;
  }

  import { twMerge } from 'tailwind-merge';
  let {
    front,
    back,
    showCardBack,
    pFront,
    pBack,
    frontTag,
    hint,
    hintTouch,
    hintDimmed,
    edgeInset
  }: Props = $props();

  const frontDivCls =
    'absolute inset-0 bg-custom-red text-white flex flex-col justify-center items-center';
  const pClass = 'text-3xl sm:text-5xl p-4 break-words [overflow-wrap:anywhere]';
  // Reserve SYMMETRIC vertical room for the hint so the text stays visually centered on the
  // card and long text never runs under the label. On touch the hint is longer
  // ("Tap to flip · Swipe to navigate") and can wrap to two lines (48px + bottom-2 8px = 56px).
  let frontCls = $derived(twMerge(frontDivCls, hint && 'py-10 pointer-coarse:py-14'));
  // On touch devices keep text clear of the edge chevrons (CSS media query, no JS, no reflow).
  let frontPCls = $derived(twMerge(pClass, edgeInset && 'pointer-coarse:px-9', pFront));
  let backPCls = $derived(twMerge(pClass, edgeInset && 'pointer-coarse:px-9', pBack));

  function limitCharacters(content: string | undefined, limit: number) {
    if (content === undefined) {
      return '';
    }
    return content.length > limit ? content.slice(0, limit) + '...' : content;
  }
</script>

<div class="relative h-full">
  <div class={frontCls}>
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    <p class={frontPCls}>{@html limitCharacters(front, 200)}</p>
    {#if frontTag}
      <span class="rounded-full bg-white/20 px-3 py-0.5 text-sm font-medium text-white"
        >{frontTag}</span
      >
    {/if}
    {#if hint}
      <span
        aria-hidden="true"
        class="pointer-events-none absolute inset-x-0 bottom-4 flex items-center justify-center gap-1.5 px-10 text-center text-base pointer-coarse:bottom-2 {hintDimmed
          ? 'text-white/80'
          : 'text-white'}"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="h-5 w-5 shrink-0"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
          />
        </svg>
        <!-- Both labels are in the HTML; CSS picks one, so the first paint is already correct. -->
        <span class={hintTouch ? 'pointer-coarse:hidden' : ''}>{hint}</span>
        {#if hintTouch}
          <span class="hidden pointer-coarse:inline">{hintTouch}</span>
        {/if}
      </span>
    {/if}
  </div>
  <div
    class="bg-custom-blue absolute inset-0 flex items-center justify-center text-white opacity-0 {showCardBack
      ? '[transform:rotateY(180deg)] opacity-100'
      : ''}"
  >
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    <p class={backPCls}>{@html back}</p>
  </div>
</div>
