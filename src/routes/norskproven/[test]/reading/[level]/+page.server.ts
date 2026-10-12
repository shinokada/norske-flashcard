import type { PageServerLoad } from './$types';
import { loadNorskprovenPage } from '$lib/server/norskproven-sources';

export const ssr = false;

// ai-docs/implementation/norskproven-server-gating.md, Phase 3.
//
// This used to be a universal +page.ts that imported the test file in the browser and
// left the Plus check to the page's onMount, so every visitor downloaded tests 2 and 3.
// The gate now runs here, before the file is read: a visitor without Plus asking for a
// test that is not free is redirected to /plus, and no test data is sent. The plan
// comes from locals.plan, never from the URL or the client.
//
// The response differs by plan for the same URL, so it must not be cached or shared.

export const load: PageServerLoad = async ({ params, locals, setHeaders }) => {
  setHeaders({ 'Cache-Control': 'private, no-store' });
  const { data, level, test } = await loadNorskprovenPage(params, locals.plan === 'plus');
  return { passages: data.reading, level, test };
};
