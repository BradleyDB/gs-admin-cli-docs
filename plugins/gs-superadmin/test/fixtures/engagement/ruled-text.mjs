// ruled-text.mjs — wordings the maintainer ruled verbatim, held once for every suite
// that must hold a surface to them (never read by the plugin: a judge, not a source).

/**
 * The How to refresh statement (Bradley, 2026-10-13, F-511 instance 27), verbatim, as its
 * three paragraphs ("/" in the ruling marks the breaks of the stepped form): the lead and the
 * three numbered steps, what the admin will see, and the session and schedule paragraph.
 * `<kb>` and `<slug>` filled in; with no folder known the ruling's `<kb>` placeholder stands.
 * @param {string} slug @param {?string} kb
 */
export const HOW_TO_REFRESH_RULED_PARTS = (slug, kb) => {
  const folder = kb ?? "<kb>";
  return [
    `Refreshes are manual: the pages change only when you run one. 1. Open a terminal in the workspace folder. That is the folder that CONTAINS the knowledge-base folder ${folder}, not ${folder} itself. Every command below is typed there. 2. Run gs-admin login if your last login was more than an hour ago. It opens your browser; finish signing in and come back to the terminal. 3. Run the refresh line: node .gs-superadmin/plugin/scripts/dashboard.mjs refresh ${slug}${kb ? ` --kb ${kb}` : ""}. Nothing else is needed.`,
    `What you will see: one line per call while it runs, then a summary. "ok": true means it finished: both pages are rebuilt and show the new pulled-at time. If the summary instead says "run gs-admin login, then run refresh … again", the login ran out before the pull did: log in (step 2) and run the same line again. It continues where it stopped, and the pages do not change until it finishes. The terminal always tells you which of the two happened.`,
    `In a Claude Code session opened in that folder, /gs-superadmin:email-engagement refresh ${slug} does all of this for you and reports the same way. To run it on a schedule on your own machine, the plugin README has the recipe: a scheduled run writes the same summary to its log instead of the screen, and needs a login within the hour before it fires.`,
  ];
};
/** The same statement as the one paragraph the closing step and the save summary carry. */
export const HOW_TO_REFRESH_RULED = (slug, kb) => HOW_TO_REFRESH_RULED_PARTS(slug, kb).join(" ");
