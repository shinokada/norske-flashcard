<script>
	// import dictionary from '$lib/data/verbs.json';
  import { twMerge } from 'tailwind-merge';
	import { Flashcard, ArrowLeft, ArrowRight } from '$lib';
  import { getRandomPair } from '$lib/utils.svelte.js';
  let { dictionary, title="Flashcard", pFront, pBack } = $props()
	let langlang = $state('noreng')
  let front = $state()
	let back = $state()
	let showCardBack = $state(false)	
	let showFront = $state('Vis norsk')
	let showBack = $state('Show English')
	let lang1lang2 = $state("text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-lg px-5 py-2.5 me-2 mb-2 dark:bg-green-600 dark:hover:bg-green-700 focus:outline-none dark:focus:ring-green-800 opacity-100");
	let lang2lang1 = $state("focus:outline-none text-white bg-purple-700 hover:bg-purple-800 focus:ring-4 focus:ring-purple-300 font-medium rounded-lg text-lg px-5 py-2.5 me-2 mb-2 dark:bg-purple-600 dark:hover:bg-purple-700 dark:focus:ring-purple-900 opacity-50");

	const toggleShowBack = () => showCardBack = !showCardBack;

	const updateLang = (lang) => {
		langlang = lang
		if (lang === 'noreng'){
			showFront = 'Vis norsk'
			showBack = 'Show English'
			lang1lang2 = twMerge(lang1lang2, 'opacity-100')
			lang2lang1 = twMerge(lang2lang1, 'opacity-50')
		} else if (lang === 'engnor'){
      showFront = 'Show English'
			showBack = 'Vis norsk'
			lang1lang2 = twMerge(lang1lang2, 'opacity-50')
			lang2lang1 = twMerge(lang2lang1, 'opacity-100')
		}
		showCardBack = false
    const { front: newFront, back: newBack } = getRandomPair(dictionary, lang, false);
    front = newFront
    back = newBack
  };

	updateLang(langlang);

	function handleKeyDown(event) {
	
    if (event.key === 'ArrowLeft') {
      toggleShowBack();
			console.log('arrowleft pressed')
    } else if (event.key === 'ArrowRight') {
      updateLang(langlang);
			console.log('arrowright is pressed')
    }
  }
	
	function preventDefault(fn) {
		return function (event) {
			event.preventDefault();
			fn.call(this, event);
		};
	}
</script>

<div class="flex flex-col items-center mt-15">
	<h1 class="text-3xl m-4">{title}</h1>
	<div class="flex justify-between">
		<button type="button" class="{lang1lang2}" on:click={() => updateLang('noreng')}>Norsk-English</button>
		<button class="{lang2lang1}" on:click={() => updateLang('engnor')}>English-Norsk</button>
	</div>
	<!-- FLASHCARD -->
	<div class="bg-transparent w-full md:w-2/3 h-96">
		<div class="flip-box-inner" class:flip-it={showCardBack}>
			<Flashcard {front} {back} {showCardBack} {pFront} {pBack}/>
		</div>
	</div>

	<!-- BUTTONS -->
	
	<div class="flex space-x-4 pt-4">
		<button 
			onclick={toggleShowBack} 
			class="inline-flex items-center min-w-44 bg-gray-300 p-4"
		>
		<ArrowLeft class="mr-4"/>
			{showCardBack ? showFront : showBack}
		</button>
		
		<button 
			class="inline-flex text-right bg-gray-300 p-4" 
			onclick={()=>updateLang(langlang)}
		>
			NEXT
			<ArrowRight class="ml-4"/>
		</button>
	</div>
	<span class="hidden lg:inline-block mt-4 right-full bg-gray-900 text-white px-2 py-1 rounded">
    Use ← to flip and → to next
	</span>
</div>	

<svelte:window onkeydown={preventDefault(handleKeyDown)} />

<style>
	/* This container is needed to position the front and back side */
	.flip-box-inner {
		position: relative;
		width: 100%;
		height: 100%;
		text-align: center;
		transition: transform 0.4s;
		transform-style: preserve-3d;
	}

	/* Do an horizontal flip on button click */
	.flip-it {
		transform: rotateY(180deg);
	}

</style>