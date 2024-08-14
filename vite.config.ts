import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';
import pkg from './package.json' with { type: 'json' };
import svelte5uilib from './node_modules/svelte-5-ui-lib/package.json' with { type: 'json' };
import sveltePackage from './node_modules/svelte/package.json' with { type: 'json' };
import svelteKitPackage from './node_modules/@sveltejs/kit/package.json' with { type: 'json' };
import vitePackage from './node_modules/vite/package.json' with { type: 'json' };


export default defineConfig({
	plugins: [sveltekit()],
	test: {
		include: ['src/**/*.{test,spec}.{js,ts}']
	},
	define: {
    __NAME__: JSON.stringify(pkg.name),
    __DESCRIPTION__: JSON.stringify(pkg.description),
    __VERSION__: JSON.stringify(pkg.version),
    __GITHUBURL__: JSON.stringify(pkg.repository.url),
    __SVELTE_VERSION__: JSON.stringify(sveltePackage.version),
    __SVELTEKIT_VERSION__: JSON.stringify(svelteKitPackage.version),
		__VITE_VERSION__: JSON.stringify(vitePackage.version),
		__SVELTE_5_UI_LIB_VERSION__: JSON.stringify(svelte5uilib.version),
  }
});
