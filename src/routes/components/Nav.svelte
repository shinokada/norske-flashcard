<script>
	import { Navbar, NavLi, NavBrand, NavUl, NavHamburger, DarkMode } from 'flowbite-svelte';
	import No from '$lib/No.svelte';
	import { page } from '$app/state';

	let activeUrl = $derived(page.url.pathname);
	let activeClass = 'p-2 text-base hover:text-gray-500';
	let nonActiveClass = 'p-2 text-base hover:text-gray-500';
</script>

<Navbar
	breakpoint="lg"
	fluid
	class="sticky top-0 z-40 mx-auto w-full flex-none border-b border-gray-200 bg-gray-50 dark:border-gray-600 dark:bg-blue-950"
	navContainerClass="lg:justify-between"
>
	<NavBrand href="/">
		<No size="40" class="inline" />
		<span class="ml-2 self-center text-xl font-semibold whitespace-nowrap dark:text-white"
			>Norske flashcard</span
		>
	</NavBrand>
	<div class="flex items-center lg:order-2">
		<DarkMode class="inline-block hover:text-gray-900 dark:hover:text-white" />
		<NavHamburger />
	</div>
	<NavUl
		breakpoint="lg"
		{activeUrl}
		class="order-2 lg:order-1"
		classes={{ active: activeClass, nonActive: nonActiveClass, ul: 'p-0' }}
	>
		<NavLi href="/">Nivå A1</NavLi>
		<NavLi href="/level-a2">Nivå A2</NavLi>
		<NavLi href="/verbs">Verbs</NavLi>
		<NavLi href="/adjectives">Adjectives</NavLi>
		<NavLi href="/vocab">Vocab</NavLi>
		<NavLi href="/education">Education</NavLi>
		<NavLi href="/about">About</NavLi>
	</NavUl>
</Navbar>
