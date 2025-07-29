<script>
	import { Navbar, NavLi, NavBrand, NavUl, NavHamburger, DarkMode } from 'flowbite-svelte';
	import No from '$lib/No.svelte';
	import { page } from '$app/state';

	let activeUrl = $state(page.url.pathname);
	$effect(() => {
		activeUrl = page.url.pathname;
	});
</script>

<header
	class="sticky top-0 z-40 mx-auto w-full flex-none border-b border-gray-200 bg-white dark:border-gray-600 dark:bg-sky-950"
>
	<Navbar fluid class="px-8">
		<NavBrand href="/">
			<No size="40" class="inline" />
			<span class="self-center text-xl font-semibold whitespace-nowrap dark:text-white ml-2">Norske flashcard</span>
		</NavBrand>
		<div class="flex items-center lg:order-2">
			<DarkMode class="inline-block hover:text-gray-900 dark:hover:text-white" />
			<NavHamburger />
		</div>
		
		<NavUl {activeUrl} class="lg:order-1 lg:space-x-5 xl:space-x-8">
			<NavLi href="/">Nivå A1</NavLi>
			<NavLi href="/level-a2">Nivå A2</NavLi>
			<NavLi href="/verbs">Verbs</NavLi>
			<NavLi href="/adjectives">Adjectives</NavLi>
			<NavLi href="/vocab">Vocab</NavLi>
			<NavLi href="/education">Education</NavLi>
			<NavLi href="/about">About</NavLi>
		</NavUl>
	</Navbar>
</header>
