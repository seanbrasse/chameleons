import { CAPS, type Issue } from '@/content/types';

export type ContentProblem = { where: string; problem: string };

/**
 * The field caps, checked rather than trusted. In the single-owner original this
 * ran at module load and failed the build; here it gates a publish, so it
 * returns every problem at once instead of throwing on the first.
 */
export function validateIssue(content: Issue): ContentProblem[] {
  const problems: ContentProblem[] = [];

  const tooLong = (where: string, value: string, cap: number) => {
    if (value.length > cap) {
      problems.push({ where, problem: `${value.length} characters, cap is ${cap}` });
    }
  };

  tooLong('settings tagline', content.settings.tagline, CAPS.tagline);
  tooLong('settings skills', content.settings.skills.join(', '), CAPS.skills);
  tooLong('settings social card description', content.settings.ogTagline, CAPS.ogTagline);
  tooLong('settings social card subtitle', content.settings.ogSubtitle, CAPS.ogSubtitle);

  for (const experience of content.experiences) {
    tooLong(`experience ${experience.id} summary`, experience.summary, CAPS.experienceSummary);

    if (experience.impactBullets.length > CAPS.impactBulletCount) {
      problems.push({
        where: `experience ${experience.id}`,
        problem: `${experience.impactBullets.length} impact bullets, max is ${CAPS.impactBulletCount}`,
      });
    }

    experience.impactBullets.forEach((bullet, i) => {
      tooLong(`experience ${experience.id} bullet ${i + 1}`, bullet, CAPS.impactBullet);
    });
  }

  for (const project of content.projects) {
    tooLong(`project ${project.id} summary`, project.summary, CAPS.projectSummary);

    if (project.story) {
      tooLong(`project ${project.id} story`, project.story, CAPS.projectStory);
    }

    if (project.context === 'professional' && !project.experienceId) {
      problems.push({
        where: `project ${project.id}`,
        problem: 'professional projects must name the employer they were built at',
      });
    }

    project.images.forEach((image, i) => {
      if (!image.alt.trim()) {
        problems.push({
          where: `project ${project.id} image ${i + 1}`,
          problem: 'alt text is empty',
        });
      }
    });
  }

  for (const testimonial of content.testimonials) {
    tooLong(`testimonial ${testimonial.id} quote`, testimonial.quote, CAPS.quote);
  }

  return problems;
}
