<script>
	import { Navbar, NavLi, NavBrand, NavUl, uiHelpers, Darkmode } from 'svelte-5-ui-lib';
	import No from '$lib/No.svelte';

	let nav = uiHelpers();

	let navStatus = $state(false);
	let toggleNav = nav.toggle;
	let closeNav = nav.close;
	let divClass = "ml-auto w-full"
    let ulClass =
    'flex flex-col py-3 lg:flex-row lg:my-0 text-sm order-1 font-medium gap-4 lg:gap-2 dark:lg:bg-transparent lg:bg-white border-0';
    let navClass = 'w-full divide-gray-200 border-gray-200 bg-white text-gray-500 dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-400 sm:px-4'

	$effect(() => {
		// this can be done adding nav.navStatus directly to DOM element
		// without using effect
		navStatus = nav.isOpen;
	});
</script>
<header
    class="sticky top-0 z-40 mx-auto w-full flex-none border-b border-gray-200 bg-white dark:border-gray-600 dark:bg-sky-950"
  >
  <Navbar {navClass} {toggleNav} {closeNav} {navStatus} breakPoint="lg" fluid divChildrenClass={divClass}>
	{#snippet brand()}
		<NavBrand siteName="Norske flashcard" {closeNav}>
			<No size={50} class="inline" />
		</NavBrand>
		<div class="flex items-center ml-auto lg:order-1">
            <Darkmode class="inline-block dark:hover:text-white hover:text-gray-900" />
        </div>
	{/snippet}
	<NavUl {ulClass}>
		<NavLi href="/" {closeNav}>Nivå A1</NavLi>
		<NavLi href="/a2" {closeNav}>Nivå A2</NavLi>
		<NavLi href="/verbs" {closeNav}>Verbs</NavLi>
		<NavLi href="/adjectives" {closeNav}>Adjectives</NavLi>
		<NavLi href="/vocab" {closeNav}>Vocab</NavLi>
		<NavLi href="/education" {closeNav}>Education</NavLi>
		<NavLi href="/credits" {closeNav}>Credits</NavLi>
	</NavUl>
</Navbar>
</header>