<script>
	import { Navbar, NavLi, NavBrand, NavUl, uiHelpers, Darkmode, Dropdown, DropdownUl, DropdownLi } from 'flowbite-svelte';
	import No from '$lib/No.svelte';
	import { page } from '$app/state';
	import ChevronDownOutline from "./ChevronDownOutline.svelte";

	let activeUrl = $state(page.url.pathname);

	// for Dropdown
  let dropdown = uiHelpers();
  let dropdownStatus = $state(false);
	let toggleDropdown = dropdown.toggle;
  let closeDropdown = dropdown.close;
	// for Dropdonw2
	let dropdown2 = uiHelpers();
	let dropdown2Status = $state(false);
	let toggleDropdown2 = dropdown2.toggle;
	let closeDropdown2 = dropdown2.close;

	let nav = uiHelpers();
	let navStatus = $state(false);
	let toggleNav = nav.toggle;
	let closeNav = nav.close;

	let divClass = 'ml-auto w-full';
	let ulclass =
		'flex flex-col py-3 lg:flex-row lg:my-0 order-1 font-medium dark:lg:bg-transparent lg:bg-white lg:border-0';
	let navClass =
		'w-full divide-gray-200 border-gray-200 bg-white text-gray-500 dark:divide-gray-700 dark:border-gray-700 dark:bg-indigo-950 dark:text-gray-400 sm:px-4';

	$effect(() => {
		// this can be done adding nav.navStatus directly to DOM element
		// without using effect
		navStatus = nav.isOpen;
		dropdownStatus = dropdown.isOpen;
		dropdown2Status = dropdown2.isOpen;
		activeUrl = page.url.pathname;
		$inspect('dropdown2Status', dropdown2Status);
	});
</script>

<header
	class="sticky top-0 z-40 mx-auto w-full flex-none border-b border-gray-200 bg-white dark:border-gray-600 dark:bg-sky-950"
>
	<Navbar {navClass} {toggleNav} {closeNav} {navStatus} breakPoint="lg" fluid div2Class={divClass}>
		{#snippet brand()}
			<NavBrand siteName="Norske flashcard">
				<No size="40" class="inline" />
			</NavBrand>
			<div class="ml-auto flex items-center lg:order-1">
				<Darkmode class="inline-block hover:text-gray-900 dark:hover:text-white" />
			</div>
		{/snippet}
		<NavUl {activeUrl} class={ulclass}>
			
			<NavLi onclick={toggleDropdown2} class="cursor-pointer relative">
        Vocab<ChevronDownOutline class="ms-2 inline h-6 w-6 text-primary-800 dark:text-white" />
				<Dropdown dropdownStatus={dropdown2Status} closeDropdown={closeDropdown2} class="absolute -top-[20px] left-[100px] md:-left-[50px] md:top-[20px]">
          <DropdownUl>
            <DropdownLi href="/verbs">Verbs</DropdownLi>
            <DropdownLi href="/adjectives">Adjectives</DropdownLi>
            <DropdownLi href="/vocab">General</DropdownLi>
						<DropdownLi href="/education">Education</DropdownLi>
          </DropdownUl>
        </Dropdown>
      </NavLi>
			<NavLi href="/sayings">Sayings</NavLi>
			<NavLi href="/about">About</NavLi>
		</NavUl>
	</Navbar>
</header>
