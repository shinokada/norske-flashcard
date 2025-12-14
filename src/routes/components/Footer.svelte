<script>
	import { Footer, FooterBrand, FooterLink, FooterLinkGroup } from 'flowbite-svelte';
</script>

<Footer class="shadow-none dark:bg-blue-950" footerType="logo">
	<div class="sm:flex sm:items-center sm:justify-between">
		<FooterBrand href="https://codewithshin.com" name="codewithshin.com" />
		<FooterLinkGroup
			class="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-500 sm:mt-0 sm:pl-4 dark:text-gray-400"
		>
			<FooterLink href="https://multilanguage-flashcard.codewithshin.com/"
				>Multilanguage flashcard</FooterLink
			>
			<FooterLink href="https://norske-flashcard.codewithshin.com/">Norske flashcard</FooterLink>
			<FooterLink href="https://nihongo-flashcard.codewithshin.com/">Japanese flashcard</FooterLink>
			<FooterLink href="https://flexilexi-dictionary.codewithshin.com/"
				>FlexiLexi dictionary</FooterLink
			>
			<FooterLink href="https://gjett-norsk.codewithshin.com/">Gjett norsk</FooterLink>
		</FooterLinkGroup>
	</div>
</Footer>
