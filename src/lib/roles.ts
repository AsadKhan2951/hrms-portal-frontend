/**
 * The role hierarchy, mirroring backend/roles.ts.
 *
 * The portal had two roles and gated every admin page on `role !== "admin"`.
 * Adding levels in the middle without changing those checks would redirect a
 * department head straight back to the dashboard, so none of the routing work
 * behind them would ever be visible.
 *
 * These are convenience checks for what to *show*. The backend enforces the
 * same hierarchy on every endpoint; nothing here is a security boundary.
 */
export const ROLES = ["user", "dept_head", "head_of_ops", "admin"] as const;

export type Role = (typeof ROLES)[number];

const RANK: Record<Role, number> = {
  user: 0,
  dept_head: 1,
  head_of_ops: 2,
  admin: 3,
};

/** Anything unrecognised is treated as the least privileged, never the most. */
function rankOf(role: string | undefined | null): number {
  return RANK[(role ?? "") as Role] ?? 0;
}

export function hasRank(role: string | undefined | null, minimum: Role): boolean {
  return rankOf(role) >= RANK[minimum];
}

/** Sees the whole organisation: every employee, payslip and report. */
export function isOrgWide(role: string | undefined | null): boolean {
  return hasRank(role, "head_of_ops");
}

/** Super admin alone - handing out roles and appointing heads. */
export function isSuperAdmin(role: string | undefined | null): boolean {
  return hasRank(role, "admin");
}

/** Leads at least one department, so has an approval queue. */
export function isAnyHead(role: string | undefined | null): boolean {
  return hasRank(role, "dept_head");
}

export const ROLE_LABELS: Record<Role, string> = {
  user: "Employee",
  dept_head: "Department Head",
  head_of_ops: "Head of Operations",
  admin: "Administrator",
};

export function roleLabel(role: string | undefined | null): string {
  return ROLE_LABELS[(role ?? "") as Role] ?? "Employee";
}
