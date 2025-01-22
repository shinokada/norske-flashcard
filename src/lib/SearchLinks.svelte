<script lang="ts">
	import { Button } from 'flowbite-svelte';
	interface Props {
		langlang: string | undefined;
		front: string | undefined;
		back: string | undefined;
	}

	let { langlang, front, back }: Props = $props();

	let searchWord = $derived(
		langlang === 'noreng' && front ? dictionaryWord(front) : back ? dictionaryWord(back) : ''
	);
	let showDictionaryLink: boolean = $derived(langlang === 'noreng' ? true : false);

	function dictionaryWord(norwegianWord: string) {
		// remove å, ei, en, et from the beginning of the norwegian word
		const normalizedNorwegianWord = norwegianWord.replace(/^([åei enet]+)\s+/, '');
		// split norwegain with a comma and select the first word
		const firstWord = normalizedNorwegianWord.split(',')[0].trim();
		// return the word
		return firstWord;
	}
	let ordbokene = $derived(`https://ordbokene.no/eng/bm,nn/${searchWord}`);
	let naob = $derived(`https://naob.no/ordbok/${searchWord}`);
</script>

<div class="mx-auto mt-4 flex w-1/3 flex-col justify-center gap-2">
	{#if showDictionaryLink}
		<Button target="_blank" href={ordbokene}>Ordbokene: {searchWord}</Button>
		<Button target="_blank" href={naob}>Naob: {searchWord}</Button>
	{/if}
</div>
