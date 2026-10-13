<script lang="ts">
  interface Props {
    front?: string;
    back?: string;
    showCardBack?: boolean;
    pFront?: string;
    pBack?: string;
    /** Small gloss shown under the front text (e.g. a vocab `sense`). */
    frontTag?: string;
    /** Small "Tap/Click to flip" label at the bottom of the front face (decorative; aria-hidden). */
    hint?: string;
    /** Soften the hint once the user has flipped a card before. */
    hintDimmed?: boolean;
  }

  import { twMerge } from 'tailwind-merge';
  let { front, back, showCardBack, pFront, pBack, frontTag, hint, hintDimmed }: Props = $props();

  const frontDivCls =
    'absolute inset-0 bg-custom-red text-white flex flex-col justify-center items-center';
  const pClass = 'text-3xl sm:text-5xl p-4 break-words [overflow-wrap:anywhere]';
  // Reserve room for the hint so long text never runs under it.
  let frontCls = $derived(twMerge(frontDivCls, hint && 'pb-10'));
  let frontPCls = $derived(twMerge(pClass, pFront));
  let backPCls = $derived(twMerge(pClass, pBack));

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
        class="pointer-events-none absolute inset-x-0 bottom-4 flex items-center justify-center gap-1.5 text-base {hintDimmed
          ? 'text-white/80'
          : 'text-white'}"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke-width="1.5"
          stroke="currentColor"
          class="h-5 w-5"
          aria-hidden="true"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
          />
        </svg>
        {hint}
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
