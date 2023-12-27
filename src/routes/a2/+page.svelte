<script>
	import dictionary from '$lib/ntnu-now2.json';
	import { Flashcard } from '$lib';
  import { getRandomPair } from '$lib/utils.svelte.js';
	let langlang = $state('noreng')
  let front = $state()
	let back = $state()
	let explanation = $state()

	let showExplain = $state(false) 
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
		showExplain = false
    const { front: newFront, back: newBack, norskexplanation } = getRandomPair(dictionary, lang, true);
		// console.log('norskexplanation inside: ', norskexplanation)
    front = newFront
    back = newBack
		explanation = norskexplanation
  };
	
	updateLang(langlang);

	const toggleNorskexplanation = () => showExplain = !showExplain 
	
</script>

<div class="flex flex-col items-center mt-15">
	<h1 class="text-3xl m-4">Nivå A2</h1>
	<div class="flex justify-between">
		<button type="button" class="text-white bg-green-700 hover:bg-green-800 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-lg px-5 py-2.5 me-2 mb-2 dark:bg-green-600 dark:hover:bg-green-700 focus:outline-none dark:focus:ring-green-800" on:click={() => updateLang('noreng')}>Norsk-English</button>
		<button class="focus:outline-none text-white bg-purple-700 hover:bg-purple-800 focus:ring-4 focus:ring-purple-300 font-medium rounded-lg text-lg px-5 py-2.5 me-2 mb-2 dark:bg-purple-600 dark:hover:bg-purple-700 dark:focus:ring-purple-900" on:click={() => updateLang('engnor')}>English-Norsk</button>
	</div>
	<!-- FLASHCARD -->
	<div class="bg-transparent w-full md:w-2/3 h-96">
		<div class="flip-box-inner" class:flip-it={showCardBack}>
			<Flashcard {front} {back} {showCardBack} />
		</div>
	</div>

	<!-- BUTTONS -->
	
	<div id="flex justify-between">
		<button onclick={toggleShowBack} class="w-40 bg-gray-300 p-4 mt-4">
			{showCardBack ? showFront : showBack}
		</button>
		
		<button class="w-20 bg-gray-300 p-4" onclick={()=>updateLang(langlang)}>NEXT</button>

		<button class="w-48 bg-gray-300 p-4" onclick={toggleNorskexplanation}>Forklare på norsk</button>
	</div>
</div>	

{#if showExplain}
<div class="m-4 p-4 bg-green-100">
	{explanation}
</div>
{/if}

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