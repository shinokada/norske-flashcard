<script lang="ts">
	interface Props {
		front?: string;
		back?: string;
		showCardBack?: boolean;
		pFront?: string;
		pBack?: string;
	}

	import { twMerge } from 'tailwind-merge';
	let { front, back, showCardBack, pFront, pBack }: Props = $props();

	const frontDivCls = 'absolute inset-0 bg-custom-red text-white flex justify-center items-center';
	const pClass = 'text-5xl p-4';
	let frontPCls = $derived(twMerge(pClass, pFront));
	let backPCls = $derived(twMerge(pClass, pBack));

	function limitCharacters(content: string | undefined, limit: number) {
		if (content === undefined) {
			return '';
		}
		return content.length > limit ? content.slice(0, limit) + '...' : content;
	}
</script>

<div class="relative h-full">
	<div class={frontDivCls}>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<p class={frontPCls}>{@html limitCharacters(front, 200)}</p>
	</div>
	<div
		class="bg-custom-blue absolute inset-0 flex items-center justify-center text-white opacity-0 {showCardBack
			? '[transform:rotateY(180deg)] opacity-100'
			: ''}"
	>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<p class={backPCls}>{@html back}</p>
	</div>
</div>
