<script>
	import { Navbar, NavLi, NavBrand, NavUl, uiHelpers, Darkmode } from 'svelte-5-ui-lib';
	import No from '$lib/No.svelte';

	let nav = uiHelpers();

	let navStatus = $state(false);
	let toggleNav = nav.toggle;
	let closeNav = nav.close;
	let divClass = 'ml-auto w-full';
	let ulclass =
    'flex flex-col py-3 lg:flex-row lg:my-0 order-1 font-medium dark:lg:bg-transparent lg:bg-white lg:border-0';
  let navclass =
    'w-full divide-gray-200 border-gray-200 bg-white text-gray-500 dark:divide-gray-700 dark:border-gray-700 dark:bg-indigo-950 dark:text-gray-400 sm:px-4';

	$effect(() => {
		// this can be done adding nav.navStatus directly to DOM element
		// without using effect
		navStatus = nav.isOpen;
	});
</script>

<header
	class="sticky top-0 z-40 mx-auto w-full flex-none border-b border-gray-200 bg-white dark:border-gray-600 dark:bg-sky-950"
>
	<Navbar {navclass} {toggleNav} {closeNav} {navStatus} breakPoint="lg" fluid div2class={divClass}>
		{#snippet brand()}
			<NavBrand siteName="Norske flashcard">
				<No size="40" class="inline" />
			</NavBrand>
			<div class="ml-auto flex items-center lg:order-1">
				<Darkmode btnclass="inline-block dark:hover:text-white hover:text-gray-900" />
			</div>
		{/snippet}
		<NavUl {ulclass}>
			<NavLi href="/">Nivå A1</NavLi>
			<NavLi href="/a2">Nivå A2</NavLi>
			<NavLi href="/verbs">Verbs</NavLi>
			<NavLi href="/adjectives">Adjectives</NavLi>
			<NavLi href="/vocab">Vocab</NavLi>
			<NavLi href="/education">Education</NavLi>
			<NavLi href="/about">About</NavLi>
		</NavUl>
	</Navbar>
</header>
