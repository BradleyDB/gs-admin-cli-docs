// build/notice-fixture.mjs — the GP-18 notice fixture the two build-lane HTML
// suites share (test-wiki-html.mjs, test-comparison-html.mjs). One home
// (Gate 2 for 0.36.2): the fixture README, the fixture catalog meta the
// [DATE] rule must OVERRIDE, and the three extraction helpers used to be
// byte-for-byte copies in both suites, so an edit to NOTICE_LEADS or the
// footer markup needed two hand-synced fixture edits. Not a runner: the
// battery fence lists build/test-*.mjs only, and this file asserts nothing.
//
// The fixture's wording is deliberately NOT the real README's (a pass proves
// the live read, not a coincidence) and its date/pin are deliberately stale
// (1999-12-31 / 0.0.1) so a page that carries them instead of the catalog's
// values reds the "computed date" arm.

export const FIXTURE_README = `# Fixture README

Intro paragraph.

> **Unaffiliated community project.** Fixture unaffiliated sentence with \`code\` and *em*.
>
> **Support expectations.** Fixture support sentence — README-only, must not ride.
>
> **Currency.** This document was last updated on 1999-12-31 (against
> \`@gainsight/gs-admin-cli@0.0.1\`) fixture currency sentence with a
> [support link](https://support.example.com).
>
> Fixture second currency paragraph, lead-less, rides with the first.

## After

Body.
`;

// The catalog meta both rigs write: the generators read cliVersion (the
// topbar / the pin) and generatedAt (the [DATE] rule).
export const FIXTURE_NOTICE_META = { cliVersion: "0.0.0-test", generatedAt: "2031-01-02T03:04:05.000Z" };

/** The inner HTML of a page's `<footer class="notice">`, or "" when absent. */
export const noticeOf = (html) => (html?.match(/<footer class="notice">([\s\S]*?)<\/footer>/) ?? [])[1] ?? "";
/** Tags stripped — the text a reader sees. */
export const stripTags = (h) => h.replace(/<[^>]+>/g, "");
/** The notice's paragraphs as tag-stripped text, in page order. */
export const noticeParagraphsOf = (footerHtml) => [...footerHtml.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => stripTags(m[1]));
