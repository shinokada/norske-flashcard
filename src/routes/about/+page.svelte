<script>
import { removeHyphensAndCapitalize } from '$lib/utils.svelte';
const name = __NAME__;
const version = __VERSION__;
const githuburl = __GITHUBURL__;
const svelte5uilibVersion = __SVELTE5UILIBVERSION__;
const svelteVersion = __SVELTEVERSION__;
const svelteKitVersion = __SVELTEKITVERSION__;
const viteVersion = __VITEVERSION__;
</script>

<div class="mx-auto max-w-4xl p-8 text-left">
	<h1>About</h1>
<p>
	Norsk-Flashcard is for Norwegian learners who want to learn Norwegian vocabulary. There are different levels of flashcards: A1, A2, Verbs, Adjectives, Vocab, and Education. 
</p>

<h2>Another LexiLearn Hub apps</h2>

  <ul class="m-4 list-disc p-4 text-left text-lg dark:text-gray-400">
    <li class="hover:text-red-700 hover:underline">
      <a href="https://gjett-norsk.vercel.app/" class="me-4 hover:underline md:me-6">Gjett Norsk</a>
    </li>
    <li class="hover:text-red-700 hover:underline">
      <a href="https://multilanguage-flashcard.vercel.app/" class="me-4 hover:underline md:me-6"
        >Multilanguage flashcard</a
      >
    </li>
    <li class="hover:text-red-700 hover:underline">
      <a href="https://norske-flashcard.vercel.app/" class="me-4 hover:underline md:me-6"
        >Norske flashcard</a
      >
    </li>
    <li class="hover:text-red-700 hover:underline">
      <a href="https://nihongo-flashcard.vercel.app/" class="me-4 hover:underline md:me-6"
        >Japanese flashcard</a
      >
    </li>
    <li class="hover:text-red-700 hover:underline">
      <a href="https://flexilexi-dictionary.vercel.app/" class="me-4 hover:underline md:me-6"
        >Fexilexi dictionary</a
      >
    </li>
  </ul>

  <h2>Technical info</h2>
  <ul class="m-4 list-disc p-4 text-left text-lg dark:text-gray-400">
    <li class="hover:text-red-700 hover:underline">
      <a
        href="https://svelte-5-preview.vercel.app/docs/introduction"
        class="me-4 hover:underline md:me-6">{removeHyphensAndCapitalize(name)} : {version}</a
      >
    </li>
    <li class="hover:text-red-700 hover:underline">
      <a
        href="https://svelte-5-preview.vercel.app/docs/introduction"
        class="me-4 hover:underline md:me-6">Svelte 5: {svelteVersion}</a
      >
    </li>
    <li>
      <a href="https://svelte-5-ui-lib.vercel.app/" class="me-4 hover:underline md:me-6"
        >Svelte 5 UI Lib: {svelte5uilibVersion}</a
      >
    </li>
    <li>
      <a href="https://kit.svelte.dev/docs/introduction" class="me-4 hover:underline md:me-6"
        >SvelteKit: {svelteKitVersion}</a
      >
    </li>
    <li class="hover:text-red-700 hover:underline">
      <a href="https://vitejs.dev/" class="hover:underline">Vite: {viteVersion}</a>
    </li>
  </ul>

  <h2 class="m-4 text-left text-2xl font-bold dark:text-white">Repo</h2>
  <ul class="m-4 list-disc p-4 text-left text-lg dark:text-gray-400">
    <li class="hover:text-red-700 hover:underline">
      <a
        href="{githuburl}"
        class="me-4 hover:underline md:me-6">Github repo</a
      >
    </li>
    <li class="hover:text-red-700 hover:underline">
      <a href="https://github.com/shinokada" class="me-4 hover:underline md:me-6">Author: Shin</a>
    </li>
  </ul>
</div>