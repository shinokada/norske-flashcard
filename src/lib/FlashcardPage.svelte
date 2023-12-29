<script>
	// import dictionary from '$lib/data/verbs.json';

	import { Flashcard, ArrowLeft, ArrowRight } from '$lib';
  import { getRandomPair } from '$lib/utils.svelte.js';
  let { dictionary, title="Flashcard", pFront, pBack } = $props()
	let langlang = $state('noreng')
  let front = $state()
	let back = $state()
	let showCardBack = $state(false)	
	let showFront = $state('Vis norsk')
	let showBack = $state('Show English')

	const toggleShowBack = () => showCardBack = !showCardBack;

	const updateLang = (lang) => {
		langlang = lang
		if (lang === 'noreng'){
			showFront = 'Vis norsk'
			showBack = 'Show English'
		} else if (lang === 'engnor'){
      showFront = 'Show English'
			showBack = 'Vis norsk'
		}
		showCardBack = false
    const { front: newFront, back: newBack } = getRandomPair(dictionary, lang);
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
		<button type="button" class="text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-lg px-5 py-2.5 me-2 mb-2 dark:bg-green-600 dark:hover:bg-green-700 focus:outline-none dark:focus:ring-green-800" on:click={() => updateLang('noreng')}>Norsk-English</button>
		<button class="focus:outline-none text-white bg-purple-700 hover:bg-purple-800 focus:ring-4 focus:ring-purple-300 font-medium rounded-lg text-lg px-5 py-2.5 me-2 mb-2 dark:bg-purple-600 dark:hover:bg-purple-700 dark:focus:ring-purple-900" on:click={() => updateLang('engnor')}>English-Norsk</button>
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
	<span class="mt-4 right-full bg-gray-900 text-white px-2 py-1 rounded text-xs">
		Use ← and → arrows to navigate
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