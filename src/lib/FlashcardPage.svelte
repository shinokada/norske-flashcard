<script lang="ts">
	import { twMerge } from 'tailwind-merge';
	import { Flashcard, ArrowLeft, ArrowRight, ArrowUp, ArrowDown } from '$lib';
	import SearchLinks from './SearchLinks.svelte';
	import { getRandomPair } from '$lib/utils.js';

	interface WordPair {
		front: string;
		back: string;
	}
	/* eslint-disable  @typescript-eslint/no-explicit-any */
	interface Props {
		dictionary: any;
		title?: string;
		pFront?: string;
		pBack?: string;
	}
	let { dictionary, title = 'Flashcard', pFront, pBack }: Props = $props();

	let front: string = $state('');
	let back: string = $state('');
	let showCardBack: boolean = $state(false);
	let showFront: string = $state('Norsk');
	let showBack: string = $state('English');
	let lang1lang2: string = $state(
		'text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-lg px-5 py-2.5 me-2 mb-2 dark:bg-green-600 dark:hover:bg-green-700 focus:outline-none dark:focus:ring-green-800 opacity-100'
	);
	let lang2lang1 = $state(
		'focus:outline-none text-white bg-purple-700 hover:bg-purple-800 focus:ring-4 focus:ring-purple-300 font-medium rounded-lg text-lg px-5 py-2.5 me-2 mb-2 dark:bg-purple-600 dark:hover:bg-purple-700 dark:focus:ring-purple-900 opacity-50'
	);

	// Add word history
	let wordHistory = $state<Array<WordPair>>([]);
	let currentIndex = $state(-1);

	const toggleShowBack = () => (showCardBack = !showCardBack);

	const getNewWord = (lang: string) => {
		const result = getRandomPair(dictionary, lang, false);
		return {
			front: result.front || '',
			back: result.back || ''
		};
	};

	const updateLang = (lang: string, addToHistory = true) => {
		langlang = lang;
		if (lang === 'noreng') {
			showFront = 'Norsk';
			showBack = 'English';
			lang1lang2 = twMerge(lang1lang2, 'opacity-100');
			lang2lang1 = twMerge(lang2lang1, 'opacity-50');
		} else if (lang === 'engnor') {
			showFront = 'English';
			showBack = 'Norsk';
			lang1lang2 = twMerge(lang1lang2, 'opacity-50');
			lang2lang1 = twMerge(lang2lang1, 'opacity-100');
		}
		showCardBack = false;

		const newWord = getNewWord(lang);
		
		if (addToHistory) {
			// Remove any forward history if we're not at the end
			if (currentIndex < wordHistory.length - 1) {
				wordHistory = wordHistory.slice(0, currentIndex + 1);
			}
			wordHistory = [...wordHistory, newWord];
			currentIndex = wordHistory.length - 1;
		}

		front = newWord.front;
		back = newWord.back;
	};

	const showPreviousWord = () => {
		if (currentIndex > 0) {
			currentIndex--;
			const prevWord = wordHistory[currentIndex];
			front = prevWord.front;
			back = prevWord.back;
			showCardBack = false;
		}
	};

	const showNextWord = () => {
		if (currentIndex < wordHistory.length - 1) {
			currentIndex++;
			const nextWord = wordHistory[currentIndex];
			front = nextWord.front;
			back = nextWord.back;
			showCardBack = false;
		}
	};

	let langlang = $state('noreng');
	
	// Initialize with first word
	$effect(() => {
		const initialWord = getNewWord(langlang);
		front = initialWord.front;
		back = initialWord.back;
		wordHistory = [initialWord];
		currentIndex = 0;
	});

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'ArrowLeft') {
			toggleShowBack();
		} else if (event.key === 'ArrowRight') {
			updateLang(langlang);
		} else if (event.key === 'ArrowUp') {
			showPreviousWord();
		} else if (event.key === 'ArrowDown') {
			showNextWord();
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
	</div>
	<!-- FLASHCARD -->
	<div class="flip-box h-96 w-full bg-transparent md:w-1/2">
		<div class="flip-box-inner" class:flip-it={showCardBack}>
			<Flashcard {front} {back} {showCardBack} {pFront} {pBack} />
		</div>
	</div>

	<!-- BUTTONS -->
	<div class="flex flex-col sm:flex-row gap-2 pt-4">
		<button
			onclick={toggleShowBack}
			class="inline-flex items-center bg-gray-300 p-4 dark:bg-gray-700"
		>
			<ArrowLeft class="mr-4" />
			{showCardBack ? showFront : showBack}
		</button>

		<button
			onclick={showPreviousWord}
			class="inline-flex items-center bg-gray-300 p-4 dark:bg-gray-700"
			disabled={currentIndex <= 0}
		>
			<ArrowUp class="mr-4" />
			Previous
		</button>

		<button
			onclick={showNextWord}
			class="inline-flex items-center bg-gray-300 p-4 dark:bg-gray-700"
			disabled={currentIndex >= wordHistory.length - 1}
		>
			<ArrowDown class="mr-4" />
			Forward
		</button>

		<button
			class="inline-flex bg-gray-300 p-4 text-right dark:bg-gray-700"
			onclick={() => updateLang(langlang)}
		>
			Next
			<ArrowRight class="ml-4" />
		</button>
	</div>
	<span class="right-full mt-4 hidden rounded bg-gray-900 px-2 py-1 text-white lg:inline-block">
		Use the left arrow key (←) to flip, right arrow key (→) for next word, up arrow key (↑) for previous word, and down arrow key (↓) to go forward.
	</span>
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
	}

	.flip-it {
		transform: rotateY(180deg);
	}
</style>