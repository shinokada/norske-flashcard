<script lang="ts">
	import { twMerge } from 'tailwind-merge';
	import { Flashcard, ArrowLeft, ArrowRight } from '$lib';
	import { getRandomPair } from '$lib/utils.svelte.js';
	import SearchLinks from './SearchLinks.svelte';

	let { dictionary, title = 'Flashcard', pFront, pBack } = $props();
	let front: string = $state('');
	let back: string = $state('');
	let explanation: string = $state('');
	let showCardBack: boolean = $state(false);
	let showFront: string = $state('Vis norsk');
	let showBack: string = $state('Show English');
	let lang1lang2: string = $state(
		'text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-lg px-5 py-2.5 me-2 mb-2 dark:bg-green-600 dark:hover:bg-green-700 focus:outline-none dark:focus:ring-green-800 opacity-100'
	);
	let lang2lang1: string = $state(
		'focus:outline-none text-white bg-purple-700 hover:bg-purple-800 focus:ring-4 focus:ring-purple-300 font-medium rounded-lg text-lg px-5 py-2.5 me-2 mb-2 dark:bg-purple-600 dark:hover:bg-purple-700 dark:focus:ring-purple-900 opacity-50'
	);
	let lang1lang1: string = $state(
		'focus:outline-none text-white bg-orange-700 hover:bg-orange-800 focus:ring-4 focus:ring-orange-300 font-medium rounded-lg text-lg px-5 py-2.5 me-2 mb-2 dark:bg-orange-600 dark:hover:bg-orange-700 dark:focus:ring-orange-900 opacity-50'
	);

	const toggleShowBack = () => (showCardBack = !showCardBack);

	const updateLang = (lang: string) => {
		langlang = lang;
		if (lang === 'noreng') {
			showFront = 'Vis norsk';
			showBack = 'Show English';
			lang1lang2 = twMerge(lang1lang2, 'opacity-100');
			lang2lang1 = twMerge(lang2lang1, 'opacity-50');
			lang1lang1 = twMerge(lang1lang1, 'opacity-50');
		} else if (lang === 'engnor') {
			showFront = 'Show English';
			showBack = 'Vis norsk';
			lang1lang2 = twMerge(lang1lang2, 'opacity-50');
			lang2lang1 = twMerge(lang2lang1, 'opacity-100');
			lang1lang1 = twMerge(lang1lang1, 'opacity-50');
		} else if (lang === 'nornor') {
			showFront = 'Forklaring';
			showBack = 'Vis norsk';
			lang1lang2 = twMerge(lang1lang2, 'opacity-50');
			lang2lang1 = twMerge(lang2lang1, 'opacity-50');
			lang1lang1 = twMerge(lang1lang1, 'opacity-100');
		}
		showCardBack = false;
		const {
			front: newFront,
			back: newBack,
			norskexplanation
		} = getRandomPair(dictionary, lang, true);
		// console.log('norskexplanation inside: ', norskexplanation)

		front = newFront;
		back = newBack;
		explanation = norskexplanation;
	};

	let langlang = $state('noreng');
	updateLang('noreng');

	$effect(() => {
		updateLang(langlang)
	});

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'ArrowLeft') {
			toggleShowBack();
			// console.log('arrowleft pressed')
		} else if (event.key === 'ArrowRight') {
			updateLang(langlang);
			// console.log('arrowright is pressed')
		}
	}

	function preventDefault(fn: (event: KeyboardEvent) => void) {
		return function (this: HTMLElement,event: KeyboardEvent) {
			event.preventDefault();
			fn.call(this, event);
		};
	}

	// function dictionaryWord(){
		// remove 
	// }
</script>

<div class="mt-15 flex flex-col items-center">
	<h1 class="m-4 text-3xl">{title}</h1>
	<div class="flex justify-between">
		<button type="button" class={lang1lang2} on:click={() => updateLang('noreng')}
			>Norsk-English</button
		>
		<button class={lang2lang1} on:click={() => updateLang('engnor')}>English-Norsk</button>
		<button class={lang1lang1} on:click={() => updateLang('nornor')}>Norsk-Norsk</button>
	</div>

	<!-- FLASHCARD -->
	<div class="flip-box h-96 w-full bg-transparent md:w-1/2">
		<div class="flip-box-inner" class:flip-it={showCardBack}>
			<Flashcard {front} {back} {showCardBack} {pFront} {pBack} />
		</div>
	</div>

	<!-- BUTTONS -->

	<div class="flex space-x-4 pt-4">
		<button onclick={toggleShowBack} class="inline-flex min-w-44 items-center bg-gray-300 dark:bg-gray-700 p-4">
			<ArrowLeft class="mr-4" />
			{showCardBack ? showFront : showBack}
		</button>

		<button class="inline-flex bg-gray-300 dark:bg-gray-700 p-4 text-right" onclick={() => updateLang(langlang)}>
			NEXT
			<ArrowRight class="ml-4" />
		</button>
	</div>
	<span class="right-full mt-4 hidden rounded bg-gray-900 px-2 py-1 text-white lg:inline-block">
		Use the left arrow key (←) to flip and the right arrow key (→) to navigate to the next word.
	</span>
</div>

<SearchLinks {langlang} {front} {back} />

<svelte:window onkeydown={preventDefault(handleKeyDown)} />

<style>
	.flip-box {
		background-color: transparent;
		/* width: 400px;
		height: 300px; */
		/* 		border: 1px solid #ddd; */
		perspective: 1000px; /* Remove this if you don't want the 3D effect */
	}
	/* This container is needed to position the front and back side */
	.flip-box-inner {
		position: relative;
		width: 100%;
		height: 100%;
		text-align: center;
		transition: transform 0.8s;
		transform-style: preserve-3d;
	}

	/* Do an horizontal flip on button click */
	.flip-it {
		transform: rotateY(180deg);
	}
</style>
