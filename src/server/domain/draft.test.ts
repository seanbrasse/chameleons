import { describe, expect, it } from 'vitest';

import { starterIssue } from '@/content/starter';

import { DRAFTING_RULE, SYSTEM, TOOL_SCHEMA, applyDraft, gapsIn, readDraft } from './draft';

describe('the drafting rule', () => {
  /**
   * The one instruction this feature exists under. A parser that invents
   * "improved performance by 40%" puts a claim the user never made under their
   * name, in front of a recruiter — worse than an empty field they would have
   * filled in themselves.
   */
  it('tells the model to transcribe rather than infer', () => {
    expect(SYSTEM).toContain(DRAFTING_RULE);
    expect(DRAFTING_RULE).toContain('Transcribe, never infer.');
    expect(DRAFTING_RULE).toMatch(/leave the field empty/i);
  });

  it('names every field it fills, so the schema is the mapping', () => {
    expect(Object.keys(TOOL_SCHEMA.properties).sort()).toEqual([
      'displayName',
      'education',
      'experiences',
      'location',
      'projects',
      'role',
      'skills',
    ]);
  });
});

describe('readDraft', () => {
  it('survives a reply that is nothing like the schema', () => {
    for (const junk of [null, undefined, 'a string', 42, [], { experiences: 'nope' }]) {
      const draft = readDraft(junk);
      expect(draft.displayName).toBe('');
      expect(draft.experiences).toEqual([]);
      expect(draft.projects).toEqual([]);
    }
  });

  /** A date the model formatted its own way must never reach a template. */
  it('keeps only month-precision dates', () => {
    const draft = readDraft({
      experiences: [
        { company: 'Mailchimp', role: 'Engineer', startDate: '2023-04', endDate: 'present' },
        { company: 'PayPal', role: 'Engineer', startDate: 'March 2021', endDate: '2023-01' },
      ],
    });

    expect(draft.experiences[0]).toMatchObject({ startDate: '2023-04', endDate: null });
    expect(draft.experiences[1]).toMatchObject({ startDate: '', endDate: '2023-01' });
  });

  it('drops rows with nothing to identify them', () => {
    const draft = readDraft({
      experiences: [{ company: '', role: 'Engineer' }, { company: 'PayPal', role: 'Engineer' }],
      education: [{ school: '  ' }, { school: 'University at Buffalo' }],
    });

    expect(draft.experiences).toHaveLength(1);
    expect(draft.education).toHaveLength(1);
  });

  it('reads a whole résumé-shaped reply', () => {
    const draft = readDraft({
      displayName: 'Sean Brasse',
      role: 'Software Engineer II',
      location: 'New York, NY',
      skills: ['React', '', 'TypeScript'],
      experiences: [
        {
          company: 'Intuit Mailchimp',
          role: 'Software Engineer II',
          location: 'New York, NY',
          startDate: '2023-04',
          endDate: '',
          summary: '',
          impactBullets: [],
        },
      ],
      education: [{ school: 'University at Buffalo', credential: 'B.S. Computer Science' }],
      projects: [{ title: 'Cadence', summary: '', date: '2026-02', tech: ['Swift'] }],
    });

    expect(draft.displayName).toBe('Sean Brasse');
    expect(draft.skills).toEqual(['React', 'TypeScript']);
    expect(draft.experiences[0]?.endDate).toBeNull();
    expect(draft.education[0]?.credential).toBe('B.S. Computer Science');
  });
});

describe('gapsIn', () => {
  /**
   * Impact is the field no document states, so it is the field the builder has
   * to ask for rather than quietly leave blank.
   */
  it('names impact when nothing in the source claimed any', () => {
    const draft = readDraft({
      role: 'Engineer',
      skills: ['React'],
      experiences: [{ company: 'PayPal', role: 'Engineer', impactBullets: [] }],
    });

    expect(gapsIn(draft).join(' ')).toMatch(/achieved/);
  });

  it('says nothing when the source did state impact', () => {
    const draft = readDraft({
      role: 'Engineer',
      skills: ['React'],
      experiences: [
        { company: 'PayPal', role: 'Engineer', impactBullets: ['Cut checkout errors by half'] },
      ],
    });

    expect(gapsIn(draft)).toEqual([]);
  });
});

describe('applyDraft', () => {
  const base = starterIssue('', 'sean@example.com');

  it('leaves project impact empty for the human to write', () => {
    const issue = applyDraft(base, readDraft({ projects: [{ title: 'Cadence' }] }));

    expect(issue.projects[0]?.title).toBe('Cadence');
    expect(issue.projects[0]?.impact).toBe('');
  });

  /** Re-reading a corrected résumé should update rows, not double them. */
  it('gives a row the same id every time, so a second read updates', () => {
    const draft = readDraft({ experiences: [{ company: 'Intuit Mailchimp', role: 'Engineer' }] });

    expect(applyDraft(base, draft).experiences[0]?.id).toBe(
      applyDraft(base, draft).experiences[0]?.id,
    );
    expect(applyDraft(base, draft).experiences[0]?.id).toMatch(/^exp-intuit-mailchimp$/);
  });

  it('keeps what the draft could not fill', () => {
    const typed = { ...base, settings: { ...base.settings, role: 'Frontend engineer' } };
    const issue = applyDraft(typed, readDraft({ displayName: 'Sean Brasse' }));

    expect(issue.settings.displayName).toBe('Sean Brasse');
    expect(issue.settings.role).toBe('Frontend engineer');
  });

  /**
   * The safety property that lets autofill run on a started editor: a row the
   * person added and the document does not mention must survive.
   */
  it('never drops a hand-typed row absent from the draft', () => {
    const started = applyDraft(
      base,
      readDraft({ experiences: [{ company: 'A side gig', role: 'Founder' }] }),
    );

    const after = applyDraft(started, readDraft({ experiences: [{ company: 'PayPal', role: 'Engineer' }] }));

    expect(after.experiences.map((role) => role.company)).toEqual(['A side gig', 'PayPal']);
  });

  /** Re-importing the same résumé is a no-op on count, and updates in place. */
  it('upserts by id rather than duplicating on a second import', () => {
    const once = applyDraft(base, readDraft({ experiences: [{ company: 'PayPal', role: 'Engineer' }] }));
    const twice = applyDraft(once, readDraft({ experiences: [{ company: 'PayPal', role: 'Senior Engineer' }] }));

    expect(twice.experiences).toHaveLength(1);
    expect(twice.experiences[0]?.role).toBe('Senior Engineer');
  });

  /**
   * Images, impact and links are the person's work, never a document's. A
   * re-import that re-mentions a project must not blank them.
   */
  it('preserves a project’s images and impact across a re-import', () => {
    const withWork: typeof base = {
      ...base,
      projects: [
        {
          id: 'proj-cadence',
          title: 'Cadence',
          summary: 'old',
          date: '2026-01',
          tech: [],
          impact: 'Shipped to 400 users',
          images: [{ src: 'https://example.com/a.png', alt: 'a', kind: 'image' }] as never,
          links: [{ label: 'Repo', url: 'https://example.com', type: 'repo' }] as never,
          starred: true,
          context: 'personal',
          status: 'shipped',
          duration: '',
        },
      ],
    };

    const after = applyDraft(withWork, readDraft({ projects: [{ title: 'Cadence', summary: 'new' }] }));

    expect(after.projects).toHaveLength(1);
    expect(after.projects[0]?.summary).toBe('new');
    expect(after.projects[0]?.impact).toBe('Shipped to 400 users');
    expect(after.projects[0]?.images).toHaveLength(1);
    expect(after.projects[0]?.links).toHaveLength(1);
    expect(after.projects[0]?.starred).toBe(true);
  });
});
