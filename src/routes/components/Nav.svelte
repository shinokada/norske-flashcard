<script>
	import { Navbar, NavLi, NavBrand, NavUl, navHelper } from 'svelte-5-ui-lib';
	import No from '$lib/No.svelte'

	let nav = navHelper();

	let navStatus = $state();
	let toggleNav = nav.toggleNav;
	let closeNav = nav.closeNav;

	$effect(() => {
		// this can be done adding nav.navStatus directly to DOM element
		// without using effect
		navStatus = nav.navStatus;
	});
</script>

<Navbar {toggleNav} {closeNav} {navStatus} breakPoint="lg">
	{#snippet brand()}
		<NavBrand siteName="Norske flashcard" {closeNav}>
			<No size={50} class="inline"/> 
			</NavBrand>
	{/snippet}
	<NavUl>
		<NavLi href="/" {closeNav}>Nivå A1</NavLi>
		<NavLi href="/a2" {closeNav}>Nivå A2</NavLi>
		<NavLi href="/verbs" {closeNav}>Verbs</NavLi>
		<NavLi href="/adjectives" {closeNav}>Adjectives</NavLi>
		<NavLi href="/vocab" {closeNav}>Vocab</NavLi>
		<NavLi href="/education" {closeNav}>Education</NavLi>
		<NavLi href="/credits" {closeNav}>Credits</NavLi>
	</NavUl>
</Navbar>
