import type { PageServerLoad } from './$types';
import { loadNorskprovenPage } from '$lib/server/norskproven-sources';

export const ssr = false;

// ai-docs/implementation/norskproven-server-gating.md, Phase 3. Same gate as the
// reading page: a visitor without Plus asking for a test that is not free is
// redirected to /plus before any test data is read or sent. The plan comes from
// locals.plan. The response differs by plan for the same URL, so it is not cached.

export const load: PageServerLoad = async ({ params, locals, setHeaders }) => {
  setHeaders({ 'Cache-Control': 'private, no-store' });
  const { data, level, test } = await loadNorskprovenPage(params, locals.plan === 'plus');
  return { scenarios: data.oral, level, test };
};
