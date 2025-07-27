<script lang="ts">
	import { onMount } from 'svelte';
	/* eslint-disable  @typescript-eslint/no-explicit-any */
	interface Props {
		dictionary: any;
		title?: string;
		pFront?: string;
		pBack?: string;
	}

	// Define an interface for word history items
	interface WordHistoryItem {
		wordFront: string | undefined;
		wordBack: string | undefined;
		wordExplanation: string | undefined;
	}

	import { twMerge } from 'tailwind-merge';
	import { Flashcard, ArrowLeft, ArrowRight, ArrowUp, ArrowDown } from '$lib';
	import { getRandomPair } from '$lib/utils.js';
	import SearchLinks from './SearchLinks.svelte';

	let { dictionary, title = 'Flashcard', pFront, pBack }: Props = $props();
	let front: string | undefined = $state('');
	let back: string | undefined = $state('');
	/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
	let explanation: string | undefined = $state('');
	let showCardBack: boolean = $state(false);
	let showFront: string = $state('Norsk');
	let showBack: string = $state('English');
	let lang1lang2: string = $state(
		'text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-lg px-3 sm:px-5 py-1 sm:py-2.5 me-1 sm:me-2 mb-1 sm:mb-2 dark:bg-green-600 dark:hover:bg-green-700 focus:outline-none dark:focus:ring-green-800 opacity-100'
	);
	let lang2lang1: string = $state(
		'focus:outline-none text-white bg-purple-700 hover:bg-purple-800 focus:ring-4 focus:ring-purple-300 font-medium rounded-lg text-lg px-3 sm:px-5 py-1 sm:py-2.5 me-1 sm:me-2 mb-1 sm:mb-2 dark:bg-purple-600 dark:hover:bg-purple-700 dark:focus:ring-purple-900 opacity-50'
	);
	let lang1lang1: string = $state(
		'focus:outline-none text-white bg-orange-700 hover:bg-orange-800 focus:ring-4 focus:ring-orange-300 font-medium rounded-lg text-lg px-3 sm:px-5 py-1 sm:py-2.5 me-1 sm:me-2 mb-1 sm:mb-2 dark:bg-orange-600 dark:hover:bg-orange-700 dark:focus:ring-orange-900 opacity-50'
	);

	// swipe
	let isTouch = $state(false);
	onMount(() => {
		isTouch = window.matchMedia('(pointer: coarse)').matches;
	});
	// touch screen
	let touchStartX = 0;
	let touchStartY = 0;
	let touchEndX = 0;
	let touchEndY = 0;

	function handleTouchStart(event: TouchEvent) {
		touchStartX = event.changedTouches[0].screenX;
		touchStartY = event.changedTouches[0].screenY;
	}

	function handleTouchEnd(event: TouchEvent) {
		touchEndX = event.changedTouches[0].screenX;
		touchEndY = event.changedTouches[0].screenY;

		const deltaX = touchEndX - touchStartX;
		const deltaY = touchEndY - touchStartY;

		if (Math.abs(deltaX) > Math.abs(deltaY)) {
			// Horizontal swipe
			if (deltaX < -30) {
				// Swipe left - navigate forward or generate new card
				if (currentIndex < wordHistory.length - 1) {
					showNextWord();
				} else {
					updateLang(langlang);
				}
			} else if (deltaX > 30) {
				// Swipe right - show previous word
				showPreviousWord();
			}
		} else {
			// Vertical swipe
			if (deltaY < -30 || deltaY > 30) {
				toggleShowBack();
			}
		}
	}

	// Add word history with the new interface
	let wordHistory = $state<Array<WordHistoryItem>>([]);
	let currentIndex = $state(-1);

	const toggleShowBack = () => (showCardBack = !showCardBack);

	const getNewWord = (lang: string) => {
		const result = getRandomPair(dictionary, lang, true);
		return {
			wordFront: result.front,
			wordBack: result.back,
			wordExplanation: result.norskexplanation
		};
	};

	const updateLang = (lang: string, addToHistory = true) => {
		langlang = lang;
		if (lang === 'noreng') {
			showFront = 'Norsk';
			showBack = 'English';
			lang1lang2 = twMerge(lang1lang2, 'opacity-100');
			lang2lang1 = twMerge(lang2lang1, 'opacity-50');
			lang1lang1 = twMerge(lang1lang1, 'opacity-50');
		} else if (lang === 'engnor') {
			showFront = 'English';
			showBack = 'Norsk';
			lang1lang2 = twMerge(lang1lang2, 'opacity-50');
			lang2lang1 = twMerge(lang2lang1, 'opacity-100');
			lang1lang1 = twMerge(lang1lang1, 'opacity-50');
		} else if (lang === 'nornor') {
			showFront = 'Forklaring';
			showBack = 'Norsk';
			lang1lang2 = twMerge(lang1lang2, 'opacity-50');
			lang2lang1 = twMerge(lang2lang1, 'opacity-50');
			lang1lang1 = twMerge(lang1lang1, 'opacity-100');
		}
		showCardBack = false;

		const newWord = getNewWord(lang);
		
		if (addToHistory) {
			// Always append new cards to the end (no truncation)
			wordHistory = [...wordHistory, newWord];
			currentIndex = wordHistory.length - 1;
		}

		front = newWord.wordFront;
		back = newWord.wordBack;
		explanation = newWord.wordExplanation;
	};

	const showPreviousWord = () => {
		if (currentIndex > 0) {
			currentIndex--;
			const prevWord = wordHistory[currentIndex];
			front = prevWord.wordFront;
			back = prevWord.wordBack;
			explanation = prevWord.wordExplanation;
			showCardBack = false;
		}
	};

	const showNextWord = () => {
		if (currentIndex < wordHistory.length - 1) {
			currentIndex++;
			const nextWord = wordHistory[currentIndex];
			front = nextWord.wordFront;
			back = nextWord.wordBack;
			explanation = nextWord.wordExplanation;
			showCardBack = false;
		}
	};

	let langlang = $state('noreng');
	
	// Initialize with first word
	$effect(() => {
		const initialWord = getNewWord(langlang);
		front = initialWord.wordFront;
		back = initialWord.wordBack;
		explanation = initialWord.wordExplanation;
		wordHistory = [initialWord];
		currentIndex = 0;
	});

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
			showPreviousWord();
		} else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
			// Navigate forward or generate new card if at the end
			if (currentIndex < wordHistory.length - 1) {
				showNextWord();
			} else {
				updateLang(langlang);
			}
		} else if (event.key === 'Enter' || event.key === ' ') {
			toggleShowBack();
		} else if (event.key === 'n' || event.key === 'N') {
			updateLang(langlang);
		}
	}

	function preventDefault(fn: (event: KeyboardEvent) => void) {
		return function (this: HTMLElement, event: KeyboardEvent) {
			event.preventDefault();
			fn.call(this, event);
		};
	}
</script>

<div class="mt-15 flex flex-col items-center">
	<h1 class="m-4 text-3xl">{title}</h1>
	<div class="flex justify-between">
		<button type="button" class={lang1lang2} onclick={() => updateLang('noreng')}
			>Norsk-English</button
		>
		<button class={lang2lang1} onclick={() => updateLang('engnor')}>English-Norsk</button>
		<button class={lang1lang1} onclick={() => updateLang('nornor')}>Norsk-Norsk</button>
	</div>

	<!-- CARD COUNTER -->
	<div class="mt-4 mb-2 text-lg font-medium text-gray-700 dark:text-gray-300">
		{currentIndex + 1}/{wordHistory.length}
	</div>

	<!-- FLASHCARD -->
	<div class="flip-box h-96 w-full bg-transparent md:w-1/2">
		<div
			class="flip-box-inner"
			class:flip-it={showCardBack}
			onclick={toggleShowBack}
			onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && toggleShowBack()}
			ontouchstart={handleTouchStart}
			ontouchend={handleTouchEnd}
			tabindex="0"
			role="button"
			aria-pressed={showCardBack}
		>
			<Flashcard {front} {back} {showCardBack} {pFront} {pBack} />
		</div>
	</div>

	<p class="right-full mt-4 rounded bg-gray-900 px-2 py-1 text-white">
		{#if isTouch}
			Swipe left or right to switch cards. Tap to flip. Or use buttons below.
		{:else}
			Click the card / press space / enter to flip.<br />
			Use ← → ↑ ↓ to navigate cards. Press N for new card. Or use buttons below.
		{/if}
	</p>

	<!-- BUTTONS -->
	<div class="grid grid-cols-3 gap-2 pt-4 sm:flex-row sm:justify-between">
		<button
			onclick={showPreviousWord}
			class="w-full inline-flex items-center bg-gray-300 p-2 sm:p-4 dark:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
			disabled={currentIndex <= 0}
		>
			<ArrowUp class="mr-4" />
			Previous
		</button>

		<button
			onclick={showNextWord}
			class="w-full inline-flex items-center bg-gray-300 p-2 sm:p-4 dark:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
			disabled={currentIndex >= wordHistory.length - 1}
		>
			<ArrowDown class="mr-4" />
			Forward
		</button>

		<button
			class="w-full inline-flex bg-gray-300 p-2 text-right sm:p-4 dark:bg-gray-700"
			onclick={() => updateLang(langlang)}
		>
			NEW CARD
			<ArrowRight class="ml-4" />
		</button>
	</div>
</div>

<SearchLinks {langlang} {front} {back} />

<svelte:window onkeydown={preventDefault(handleKeyDown)} />

<style>
	.flip-box {
		background-color: transparent;
		perspective: 1000px;
	}
	.flip-box-inner {
		position: relative;
		width: 100%;
		height: 100%;
		text-align: center;
		transition: transform 0.8s;
		transform-style: preserve-3d;
		cursor: pointer;
		user-select: none;
	}

	.flip-it {
		transform: rotateY(180deg);
	}
</style>