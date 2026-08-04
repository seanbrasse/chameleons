import { describe, expect, it } from 'vitest';

import { starterIssue } from '@/content/starter';

import {
  readTestimonialForm,
  removeTestimonial,
  setTestimonialApproved,
  upsertTestimonial,
} from './edit-testimonials';

const form = (values: Record<string, string>) => (name: string) => values[name] ?? null;
const base = form({ quote: 'They shipped it', authorName: 'Kim', authorRole: 'PM' });

describe('upsertTestimonial', () => {
  /**
   * Words attributed to someone else should not go live because they were
   * typed. Approval is a separate, deliberate act.
   */
  it('adds a testimonial unapproved', () => {
    const next = upsertTestimonial(
      starterIssue('Sam', 'sam@example.com'),
      't-1',
      readTestimonialForm(base),
    );
    expect(next.testimonials[0]).toMatchObject({ id: 't-1', approved: false });
  });

  it('does not change approval when the quote is edited', () => {
    const issue = starterIssue('Sam', 'sam@example.com');
    const added = upsertTestimonial(issue, 't-1', readTestimonialForm(base));
    const approved = setTestimonialApproved(added, 't-1', true);

    const edited = upsertTestimonial(
      approved,
      't-1',
      readTestimonialForm(form({ quote: 'Reworded', authorName: 'Kim' })),
    );

    expect(edited.testimonials[0]?.quote).toBe('Reworded');
    expect(edited.testimonials[0]?.approved).toBe(true);
  });

  it('replaces in place rather than moving the row', () => {
    const issue = starterIssue('Sam', 'sam@example.com');
    const two = upsertTestimonial(
      upsertTestimonial(issue, 't-1', readTestimonialForm(base)),
      't-2',
      readTestimonialForm(form({ quote: 'B', authorName: 'Lee' })),
    );

    const updated = upsertTestimonial(
      two,
      't-1',
      readTestimonialForm(form({ quote: 'A2', authorName: 'Kim' })),
    );

    expect(updated.testimonials.map((t) => t.id)).toEqual(['t-1', 't-2']);
    expect(updated.testimonials[0]?.quote).toBe('A2');
  });

  it('clears an employer the edit no longer names', () => {
    const issue = starterIssue('Sam', 'sam@example.com');
    const linked = upsertTestimonial(
      issue,
      't-1',
      readTestimonialForm(form({ quote: 'A', authorName: 'Kim', experienceId: 'exp-1' })),
    );
    expect(linked.testimonials[0]?.experienceId).toBe('exp-1');

    const unlinked = upsertTestimonial(linked, 't-1', readTestimonialForm(base));
    expect(unlinked.testimonials[0]?.experienceId).toBeUndefined();
  });

  it('does not mutate the issue it was given', () => {
    const issue = starterIssue('Sam', 'sam@example.com');
    upsertTestimonial(issue, 't-1', readTestimonialForm(base));
    expect(issue.testimonials).toHaveLength(0);
  });
});

describe('setTestimonialApproved', () => {
  it('flips only the named row', () => {
    const issue = starterIssue('Sam', 'sam@example.com');
    const two = upsertTestimonial(
      upsertTestimonial(issue, 't-1', readTestimonialForm(base)),
      't-2',
      readTestimonialForm(form({ quote: 'B', authorName: 'Lee' })),
    );

    const approved = setTestimonialApproved(two, 't-1', true);
    expect(approved.testimonials[0]?.approved).toBe(true);
    expect(approved.testimonials[1]?.approved).toBe(false);
  });
});

describe('removeTestimonial', () => {
  it('drops only the matching row', () => {
    const issue = starterIssue('Sam', 'sam@example.com');
    const added = upsertTestimonial(issue, 't-1', readTestimonialForm(base));
    expect(removeTestimonial(added, 't-1').testimonials).toHaveLength(0);
    expect(removeTestimonial(added, 'nope')).toEqual(added);
  });
});
