import { describe, expect, it } from 'vitest';

import { DEFAULT_TEMPLATE_ID, getManifest, listManifests } from './manifests';

describe('getManifest', () => {
  it('finds a registered template', () => {
    expect(getManifest(DEFAULT_TEMPLATE_ID)?.id).toBe(DEFAULT_TEMPLATE_ID);
  });

  /**
   * A site can name a template this build no longer ships. Callers branch on
   * null — the editor stops claiming which sections are shown, the render path
   * 404s — so returning something plausible instead would be worse than
   * returning nothing.
   */
  it('returns null rather than a substitute for one it does not have', () => {
    expect(getManifest('no-such-template')).toBeNull();
    expect(getManifest('')).toBeNull();
  });
});

describe('every manifest', () => {
  it('declares which parts of an Issue it shows', () => {
    // `uses` drives the editor's "this design does not show metrics" note. An
    // empty list would tell a user that nothing they write is rendered.
    for (const manifest of listManifests()) {
      expect(manifest.uses.length, manifest.id).toBeGreaterThan(0);
      expect(new Set(manifest.uses).size, `${manifest.id} lists a part twice`).toBe(
        manifest.uses.length,
      );
    }
  });

  it('carries the brief the design was built from', () => {
    // Plan §20.5: a template records its own constraint and references so the
    // next person can tell a faithful change from a drifting one.
    for (const manifest of listManifests()) {
      expect(manifest.constraint.length, manifest.id).toBeGreaterThan(0);
      expect(manifest.references.length, manifest.id).toBeGreaterThan(0);
    }
  });

  it('has a unique id', () => {
    const ids = listManifests().map((manifest) => manifest.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('carries the attributes the picker filters by', () => {
    // The gallery filters on `useCases`, so a template with none can never be
    // found through the filter it should appear in — it would only ever show
    // when no filter is set.
    for (const manifest of listManifests()) {
      expect(manifest.attributes.useCases.length, manifest.id).toBeGreaterThan(0);
      expect(new Set(manifest.attributes.useCases).size, `${manifest.id} repeats a use case`).toBe(
        manifest.attributes.useCases.length,
      );
      expect(
        ['image-forward', 'balanced', 'text-led'],
        manifest.id,
      ).toContain(manifest.attributes.imagery);
    }
  });
});
