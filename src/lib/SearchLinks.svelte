<script lang="ts">
	import { Button } from 'svelte-5-ui-lib';
	interface Props {
		langlang: string | undefined;
		front: string | undefined;
		back: string | undefined;
	}

	let { langlang, front, back }: Props = $props();

	let searchWord = $derived(
		front ? dictionaryWord(front) : ''
	);

	let norskord = $derived(
		langlang === 'noreng' && front 
        ? dictionaryWord(front)
        : langlang === 'engnor' && back
        ? dictionaryWord(back)
        : ''
	);
	// $effect(() => {
	// 	$inspect('norskord: ',norskord, front, back);
	// });
	let showDictionaryLink: boolean = $derived(langlang === 'noreng' || langlang === 'engnor');

	function dictionaryWord(norwegianWord: string) {
		// remove å, ei, en, et from the beginning of the norwegian word
		const normalizedNorwegianWord = norwegianWord.replace(/^([åei enet]+)\s+/, '');
		// split norwegain with a comma and select the first word
		const firstWord = normalizedNorwegianWord.split(',')[0].trim();
		// return the word
		return firstWord;
	}
	let ordbokene = $derived(`https://ordbokene.no/eng/bm,nn/${norskord}`);
	let naob = $derived(`https://naob.no/ordbok/${norskord}`);
</script>

<div class="mx-auto mt-4 flex w-1/3 justify-center gap-2">
	{#if showDictionaryLink}
		<Button class="p-2 sm:p-4" target="_blank" href={ordbokene}>Ordbok: {searchWord}</Button>
		<Button class="p-2 sm:p-4" target="_blank" href={naob}>Naob: {searchWord}</Button>
	{/if}
</div>
