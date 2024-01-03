<script>
	import '../app.pcss';
	let { children } = $props();
  import { Navbar, Footer } from '$lib'
</script>

<Navbar />

<section class="bg-white dark:bg-gray-900">
  <div class="pt-8 px-4 mx-auto max-w-screen-xl text-center">
    {@render children()}
  </div>
</section>

<Footer siteName="LexiLearn Hub"/>
