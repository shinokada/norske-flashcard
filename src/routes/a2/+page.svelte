<script>
	import dictionary from '$lib/ntnu-now2.json';
	// import { dictionary } from '$lib/test.json';
	import { Flashcard } from '$lib';
  import { getRandomItemFromDictionary, openTab, cleanWord } from '$lib/utils.js';

	let norsk = $state()
	let english = $state()
  let norskexplanation = $state()
	let randomElement = $state(getRandomItemFromDictionary(dictionary))
  // console.log(randomElement)
  // let flashcardIndex = $state()
	let keys = $derived(Object.keys(randomElement))
  const key = Object.keys(randomElement)[0];
	norsk = randomElement[key].norsk
	english = randomElement[key].english
  norskexplanation = randomElement[key].norskexplanation;

	let showCardBack = $state(false)	

	const toggleShowBack = () => showCardBack = !showCardBack;

	const nextCard = () => {
		showCardBack = false;
		randomElement = getRandomItemFromDictionary(dictionary)
		let key = Object.keys(randomElement)[0];
		norsk = randomElement[key].norsk
    english = randomElement[key].english
    norskexplanation = randomElement[key].norskexplanation;
	}
</script>

<div class="flex flex-col items-center mt-15">
	<!-- FLASHCARD -->
	<h1 class="text-3xl m-4">Nivå A2</h1>
	<div class="bg-transparent w-96 h-40">
		<div class="flip-box-inner" class:flip-it={showCardBack}>
			<Flashcard {norsk} 
								 {english} 
								 {showCardBack} 
								 />
		</div>
	</div>

	<!-- BUTTONS -->
	
	<div id="btn-cont">
		<button onclick={toggleShowBack}>
			{showCardBack ? "Hide Answer" : "Show Answer"}
		</button>
		
		<button class="arrow-btn" onclick={nextCard}>NEXT</button>
	</div>
</div>	

<style>
	
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
	
	#btn-cont {
		width: 200px;
		padding: 10px 0;
		display: flex;
		justify-content: space-between;
	}

	button {
		background-color: 	hsl(65, 6%, 40%);
		padding: 10px 10px;
		color: white;
		cursor: pointer;
	}
	
	button:active {
		background-color: hsl(50, 65%, 25%);
	}
</style>