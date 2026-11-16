/**
 * Which organisation this portal belongs to. One codebase serves several
 * companies (heard, skntheory, movement), each built on its own subdomain; the
 * name comes from that build's settings, e.g. VITE_ORG_NAME=skntheory in the
 * tenant's frontend/.env.production.local. Empty means no name is shown, which
 * is how the original portal looks.
 */
export const ORG_NAME = String(import.meta.env.VITE_ORG_NAME ?? "").trim();

/** The browser tab title: "Now | skntheory - HRMS Portal", or the plain one. */
export const PAGE_TITLE = ORG_NAME ? `Now | ${ORG_NAME} - HRMS Portal` : "Now - HRMS Portal";
