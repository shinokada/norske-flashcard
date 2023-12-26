<script>
	import { dictionary } from '$lib/ntnu-now-original.json';
	// import { dictionary } from '$lib/test.json';
	import { Flashcard } from '$lib';
  import { getRandomItemFromDictionary } from '$lib/utils.js';

	let randomElement = $state(getRandomItemFromDictionary(dictionary))
	let keys = $derived(Object.keys(randomElement))
	let norsk = $state(keys[0])
	let english = $state(randomElement[norsk])
	let showCardBack = $state(false)	

	const toggleShowBack = () => showCardBack = !showCardBack;

	const nextCard = () => {
		showCardBack = false;
		randomElement = getRandomItemFromDictionary(dictionary)
		let newkeys = Object.keys(randomElement)
		norsk = newkeys[0]
		english = randomElement[norsk]
	}
</script>

<div class="flex flex-col items-center mt-15">
	<h1 class="text-3xl m-4">Nivå A1</h1>
	<!-- FLASHCARD -->
	<div class="bg-transparent w-full md:w-2/3 h-96">
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
			{showCardBack ? "Vis norsk" : "Show Answer"}
		</button>
		
		<button class="arrow-btn" onclick={nextCard}>NEXT</button>
	</div>
</div>	

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