import { useMemo } from "react";

import type { Issue } from "@/content/types";
import type { TemplateProps } from "../types";
import type { TimelineOptions } from "./manifest";
import type { TimelineTokens } from "./tokens";

import { ThemeScript } from "./ThemeScript";
import { ThemeToggle } from "./ThemeToggle";
import { Work } from "./Work";
import "./template.css";

function ordered(issue: Issue, leadWithStarred: boolean) {
  return [...issue.projects].sort(
    (a, b) =>
      (leadWithStarred
        ? Number(b.starred ?? false) - Number(a.starred ?? false)
        : 0) || b.date.localeCompare(a.date),
  );
}

export function Template({
  issue,
  options,
}: TemplateProps<TimelineTokens, TimelineOptions>) {
  const { settings, experiences, education } = issue;
  const projects = useMemo(
    () => ordered(issue, options.leadWithStarred),
    [issue, options.leadWithStarred],
  );

  return (
    <>
      <ThemeScript />
      <div className="screen">
        <div className="intro">
          <ThemeToggle />

          <div className="intro-lede">
            <h1>{settings.displayName}</h1>
            {settings.rolesOpenTo[0] && (
              <p className="intro-role">
                {settings.rolesOpenTo[0]}
                {settings.location ? ` · ${settings.location}` : ""}
              </p>
            )}
            <p className="intro-tagline">{settings.tagline}</p>

            {options.showSkills && settings.skills.length > 0 && (
              <>
                <h2 className="section-label intro-skills-label">Skills</h2>
                <ul className="skills">
                  {settings.skills.map((skill) => (
                    <li key={skill}>{skill}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>

        <section className="work" aria-labelledby="work-label">
          <h2 className="sr-only" id="work-label">
            Selected work
          </h2>
          <Work
            projects={projects}
            experiences={experiences}
            education={education}
          />
        </section>
      </div>

      <footer className="site-footer">
        <div className="site-footer-inner">
          {/* Decorative: the name is in the copyright line two columns over. */}
          <p className="footer-mark" aria-hidden="true">
            {settings.displayName.charAt(0)}
          </p>

          <div className="footer-col">
            <ul>
              {settings.contactEmail && (
                <li>
                  <a href={`mailto:${settings.contactEmail}`}>
                    {settings.contactEmail}
                  </a>
                </li>
              )}
              {settings.links.map((link) => (
                <li key={link.url}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    {link.label}
                  </a>
                </li>
              ))}
              {settings.resumeHref && (
                <li>
                  <a href={settings.resumeHref}>Resume</a>
                </li>
              )}
            </ul>
          </div>

          <p className="footer-fine">
            © {new Date().getFullYear()} {settings.displayName}
            {settings.location ? ` · ${settings.location}` : ""}
          </p>
        </div>
      </footer>
    </>
  );
}
