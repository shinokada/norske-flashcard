<script>
	import '../app.pcss';
	let { children } = $props();
</script>

<section class="bg-white dark:bg-gray-900">
  <div class="pt-8 px-4 mx-auto max-w-screen-xl text-center z-10">
    {@render children()}
  </div>
</section>
