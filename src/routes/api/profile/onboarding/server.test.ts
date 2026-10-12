import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PATCH } from './+server';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/profile/onboarding', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
}

function makeRawRequest(rawBody: string) {
  return new Request('http://localhost/api/profile/onboarding', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: rawBody
  });
}

// ── Locals factory ───────────────────────────────────────────────────────────

const mockUpsert = vi.fn();

function makeLocals(overrides?: { user?: unknown }) {
  return {
    user: overrides?.user !== undefined ? overrides.user : { id: 'user-123' },
    supabase: {
      from: () => ({
        upsert: mockUpsert
      })
    }
  } as never;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('PATCH /api/profile/onboarding', () => {
  beforeEach(() => {
    mockUpsert.mockReset();
    mockUpsert.mockResolvedValue({ error: null });
  });

  // ── Auth guard ────────────────────────────────────────────────────────────

  it('throws 401 when not authenticated', async () => {
    await expect(
      PATCH({
        request: makeRequest({ display_name: 'Anna' }),
        locals: makeLocals({ user: null })
      } as never)
    ).rejects.toMatchObject({
      status: 401,
      body: { message: expect.stringMatching(/unauthorized/i) }
    });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  // ── Body validation ───────────────────────────────────────────────────────

  it('throws 400 for invalid JSON body', async () => {
    await expect(
      PATCH({ request: makeRawRequest('not json {'), locals: makeLocals() } as never)
    ).rejects.toMatchObject({
      status: 400,
      body: { message: expect.stringMatching(/invalid json/i) }
    });
  });

  it('throws 400 when the body is null', async () => {
    await expect(
      PATCH({ request: makeRequest(null), locals: makeLocals() } as never)
    ).rejects.toMatchObject({
      status: 400,
      body: { message: expect.stringMatching(/invalid request body/i) }
    });
  });

  it('throws 400 when the body is an array', async () => {
    await expect(
      PATCH({ request: makeRequest([1, 2, 3]), locals: makeLocals() } as never)
    ).rejects.toMatchObject({
      status: 400,
      body: { message: expect.stringMatching(/invalid request body/i) }
    });
  });

  it('throws 400 when the body is a primitive', async () => {
    await expect(
      PATCH({ request: makeRequest('hello'), locals: makeLocals() } as never)
    ).rejects.toMatchObject({
      status: 400,
      body: { message: expect.stringMatching(/invalid request body/i) }
    });
  });

  // ── Field validation ──────────────────────────────────────────────────────

  it('throws 422 when display_name exceeds 40 characters', async () => {
    await expect(
      PATCH({
        request: makeRequest({ display_name: 'a'.repeat(41) }),
        locals: makeLocals()
      } as never)
    ).rejects.toMatchObject({
      status: 422,
      body: { message: expect.stringMatching(/display name/i) }
    });
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('throws 422 for an invalid current_level', async () => {
    await expect(
      PATCH({ request: makeRequest({ current_level: 'Z9' }), locals: makeLocals() } as never)
    ).rejects.toMatchObject({
      status: 422,
      body: { message: expect.stringMatching(/level/i) }
    });
  });

  it('throws 422 for an invalid flashcard_language', async () => {
    await expect(
      PATCH({
        request: makeRequest({ flashcard_language: 'klingon' }),
        locals: makeLocals()
      } as never)
    ).rejects.toMatchObject({
      status: 422,
      body: { message: expect.stringMatching(/invalid flashcard language/i) }
    });
  });

  it('accepts flashcard_language german', async () => {
    const res = await PATCH({
      request: makeRequest({ flashcard_language: 'german' }),
      locals: makeLocals()
    } as never);
    expect(res.status).toBe(200);
    const [payload] = mockUpsert.mock.calls[0];
    expect(payload.flashcard_language).toBe('german');
  });

  it('throws 422 when onboarding_snoozed_at is not a string or null', async () => {
    await expect(
      PATCH({
        request: makeRequest({ onboarding_snoozed_at: 12345 }),
        locals: makeLocals()
      } as never)
    ).rejects.toMatchObject({
      status: 422,
      body: { message: expect.stringMatching(/onboarding_snoozed_at/i) }
    });
  });

  // ── No-op ─────────────────────────────────────────────────────────────────

  it('returns ok without writing when the body has no recognized fields', async () => {
    const res = await PATCH({ request: makeRequest({}), locals: makeLocals() } as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('ignores country and the removed language/goal fields', async () => {
    const res = await PATCH({
      request: makeRequest({
        country: 'NO',
        native_language: 'ja',
        other_languages: ['en'],
        study_goals: ['vocab']
      }),
      locals: makeLocals()
    } as never);
    expect(res.status).toBe(200);
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  // ── Field normalization & persistence ────────────────────────────────────

  it('trims display_name and writes the user id + updated_at', async () => {
    const res = await PATCH({
      request: makeRequest({ display_name: '  Anna  ' }),
      locals: makeLocals()
    } as never);

    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);

    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const [payload, options] = mockUpsert.mock.calls[0];
    expect(payload.id).toBe('user-123');
    expect(payload.display_name).toBe('Anna');
    expect(typeof payload.updated_at).toBe('string');
    expect(options).toEqual({ onConflict: 'id' });
  });

  it('clears display_name when set to null', async () => {
    await PATCH({ request: makeRequest({ display_name: null }), locals: makeLocals() } as never);
    const [payload] = mockUpsert.mock.calls[0];
    expect(payload.display_name).toBeNull();
  });

  it('normalizes an empty current_level to null', async () => {
    await PATCH({ request: makeRequest({ current_level: '' }), locals: makeLocals() } as never);
    const [payload] = mockUpsert.mock.calls[0];
    expect(payload.current_level).toBeNull();
  });

  it('accepts a valid current_level', async () => {
    await PATCH({ request: makeRequest({ current_level: 'B2' }), locals: makeLocals() } as never);
    const [payload] = mockUpsert.mock.calls[0];
    expect(payload.current_level).toBe('B2');
  });

  it('coerces onboarding_done to a boolean', async () => {
    await PATCH({ request: makeRequest({ onboarding_done: 1 }), locals: makeLocals() } as never);
    const [payload] = mockUpsert.mock.calls[0];
    expect(payload.onboarding_done).toBe(true);
  });

  it('allows onboarding_snoozed_at to be cleared with null', async () => {
    await PATCH({
      request: makeRequest({ onboarding_snoozed_at: null }),
      locals: makeLocals()
    } as never);
    const [payload] = mockUpsert.mock.calls[0];
    expect(payload.onboarding_snoozed_at).toBeNull();
  });

  it('accepts an ISO timestamp for onboarding_snoozed_at', async () => {
    const ts = '2026-06-15T12:00:00.000Z';
    await PATCH({
      request: makeRequest({ onboarding_snoozed_at: ts }),
      locals: makeLocals()
    } as never);
    const [payload] = mockUpsert.mock.calls[0];
    expect(payload.onboarding_snoozed_at).toBe(ts);
  });

  // ── DB error ──────────────────────────────────────────────────────────────

  it('throws 500 when the Supabase upsert fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockUpsert.mockResolvedValue({ error: { message: 'connection refused' } });

    await expect(
      PATCH({ request: makeRequest({ display_name: 'Anna' }), locals: makeLocals() } as never)
    ).rejects.toMatchObject({
      status: 500,
      body: { message: expect.stringMatching(/failed to save/i) }
    });

    consoleSpy.mockRestore();
  });
});
