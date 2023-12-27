<script>
	let { front, back, showCardBack } = $props()
	
	const frontClass = "absolute inset-0 bg-custom-red text-white flex justify-center items-center"
</script>

<div class="relative h-full">
	<div class={frontClass}>
			<p class="text-3xl p-8">{front}</p>
	</div>
	<div class="absolute inset-0 bg-custom-blue text-white flex justify-center items-center opacity-0 {showCardBack ? 'opacity-100 [transform:rotateY(180deg)]' : ''}">
			<p class="text-3xl p-8">{@html back}</p>
	</div>
</div>
