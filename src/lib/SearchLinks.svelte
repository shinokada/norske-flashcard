<script lang="ts">
  import { Button } from 'svelte-5-ui-lib';
  interface Props {
    langlang: string;
    front: string;
    back: string;
  }

  let { langlang, front, back }: Props = $props();

  const ordbokene = 'https://ordbokene.no/bm,nn/search?q='
	const naob= 'https://naob.no/s%C3%B8k/'

  let searchWord = $derived(langlang === 'noreng' ? dictionaryWord(front) : dictionaryWord(back))
	let showDictionaryLink: boolean = $derived(langlang==='noreng'?true:false);

  function dictionaryWord(norwegianWord: string){
		// remove å, ei, en, et from the beginning of the norwegian word
    const normalizedNorwegianWord = norwegianWord.replace(/^([åei enet]+)\s+/, '');
		// split norwegain with a comma and select the first word
		const firstWord = normalizedNorwegianWord.split(',')[0].trim();
		// return the word
		return firstWord;
	}
</script>


<div class='flex flex-col w-1/3 mx-auto gap-2 mt-4 justify-center'>
	{#if showDictionaryLink}
	<Button target="_blank" href={ordbokene} searchWord={searchWord}>Ordbokene: {searchWord}</Button>
	<Button target="_blank" href={naob} searchWord={searchWord}>Naob: {searchWord}</Button>
	{/if}
</div>