<script>
	let { norsk, english, showCardBack } = $props()
</script>

<div class="relative h-full">
	<div class="absolute inset-0 bg-custom-red text-white flex justify-center items-center">
			<p class="text-3xl">{norsk}</p>
	</div>
	<div class="absolute inset-0 bg-custom-blue text-white flex justify-center items-center opacity-0 {showCardBack ? 'opacity-100 [transform:rotateY(180deg)]' : ''}">
			<p class="text-3xl">{english}</p>
	</div>
</div>
