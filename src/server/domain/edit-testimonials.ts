import type { Issue, Testimonial } from '@/content/types';

/**
 * `approved` is not here. A testimonial's approval is the owner's judgement on
 * someone else's words, and the moment it becomes a field in the same form as
 * the quote itself, editing the quote and approving it are one action. It gets
 * its own toggle (plan §13.3), the same way the original kept starring separate
 * from editing.
 */
export type TestimonialEdit = Pick<
  Testimonial,
  'quote' | 'authorName' | 'authorRole' | 'authorCompany'
> & { experienceId?: string };

export function readTestimonialForm(get: (name: string) => string | null): TestimonialEdit {
  const text = (name: string) => (get(name) ?? '').trim();
  const employer = text('experienceId');

  return {
    quote: text('quote'),
    authorName: text('authorName'),
    authorRole: text('authorRole'),
    authorCompany: text('authorCompany'),
    ...(employer ? { experienceId: employer } : {}),
  };
}

export function upsertTestimonial(issue: Issue, id: string, edit: TestimonialEdit): Issue {
  const existing = issue.testimonials.find((testimonial) => testimonial.id === id);

  if (!existing) {
    // Unapproved by default. A quote appearing on a live site the moment it is
    // typed is the wrong default for words attributed to someone else.
    return { ...issue, testimonials: [...issue.testimonials, { id, approved: false, ...edit }] };
  }

  return {
    ...issue,
    testimonials: issue.testimonials.map((testimonial) =>
      testimonial.id === id
        ? { ...existing, experienceId: undefined, ...edit }
        : testimonial,
    ),
  };
}

/** Approval is its own action, so editing a quote never silently publishes it. */
export function setTestimonialApproved(issue: Issue, id: string, approved: boolean): Issue {
  return {
    ...issue,
    testimonials: issue.testimonials.map((testimonial) =>
      testimonial.id === id ? { ...testimonial, approved } : testimonial,
    ),
  };
}

export function removeTestimonial(issue: Issue, id: string): Issue {
  return {
    ...issue,
    testimonials: issue.testimonials.filter((testimonial) => testimonial.id !== id),
  };
}
