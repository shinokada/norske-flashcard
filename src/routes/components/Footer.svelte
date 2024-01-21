<script>
	import { Footer, FooterBrand, FooterLi, FooterUl } from 'svelte-5-ui-lib';
</script>

<Footer class="shadow-none dark:bg-gray-900" footerType="logo">
	<div class="sm:flex sm:items-center sm:justify-between">
		<FooterBrand href="/" name="LexiLearn Hub" />
		<FooterUl
			ulClass="flex flex-wrap items-center mt-3 sm:pl-4 text-sm text-gray-500 dark:text-gray-400 gap-2 sm:mt-0"
		>
			<FooterLi href="https://multilanguage-flashcard.vercel.app/" target="_blank"
				>Multilanguage flashcard</FooterLi
			>
			<FooterLi href="https://norske-flashcard.vercel.app/" target="_blank"
				>Norske flashcard</FooterLi
			>
			<FooterLi href="https://nihongo-flashcard.vercel.app/" target="_blank"
				>Japanese flashcard</FooterLi
			>
			<FooterLi href="https://flexilexi-dictionary.vercel.app/" target="_blank"
				>FlexiLexi dictionary</FooterLi
			>
			<FooterLi href="https://gjett-norsk.vercel.app/" target="_blank">Gjett norsk</FooterLi>
		</FooterUl>
	</div>
</Footer>
