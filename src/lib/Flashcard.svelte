<script>
	import { twMerge } from 'tailwind-merge';
	let { front, back, showCardBack, pFront, pBack } = $props();

	const frontDivCls = 'absolute inset-0 bg-custom-red text-white flex justify-center items-center';
	const pClass = 'text-5xl p-8';
	let frontPCls = twMerge(pClass, pFront);
	let backPCls = twMerge(pClass, pBack);

	function limitCharacters(content, limit) {
		return content.length > limit ? content.slice(0, limit) + '...' : content;
	}
</script>

<div class="relative h-full">
	<div class={frontDivCls}>
		<p class={frontPCls}>{@html limitCharacters(front, 200)}</p>
	</div>
	<div
		class="absolute inset-0 flex items-center justify-center bg-custom-blue text-white opacity-0 {showCardBack
			? 'opacity-100 [transform:rotateY(180deg)]'
			: ''}"
	>
		<p class={backPCls}>{@html back}</p>
	</div>
</div>
