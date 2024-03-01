<script>
	import { Footer, FooterBrand, FooterLi, FooterUl } from 'svelte-5-ui-lib';
</script>

<Footer footerclass="shadow-none dark:bg-blue-950" footerType="logo">
	<div class="sm:flex sm:items-center sm:justify-between">
		<FooterBrand href="/" name="LexiLearn Hub" />
		<FooterUl
			ulclass="flex flex-wrap items-center mt-3 sm:pl-4 text-sm text-gray-500 dark:text-gray-400 gap-2 sm:mt-0"
		>
			<FooterLi href="https://multilanguage-flashcard.codewithshin.com/" target="_blank"
				>Multilanguage flashcard</FooterLi
			>
			<FooterLi href="https://norske-flashcard.codewithshin.com/" target="_blank"
				>Norske flashcard</FooterLi
			>
			<FooterLi href="https://nihongo-flashcard.codewithshin.com/" target="_blank"
				>Japanese flashcard</FooterLi
			>
			<FooterLi href="https://flexilexi-dictionary.codewithshin.com/" target="_blank"
				>FlexiLexi dictionary</FooterLi
			>
			<FooterLi href="https://gjett-norsk.codewithshin.com/" target="_blank">Gjett norsk</FooterLi>
		</FooterUl>
	</div>
</Footer>
