/**
 * The backend runs on its own origin in production (Vercel frontend +
 * Railway/Render backend), so REST endpoints and stored file URLs both need the
 * API base prepended. Locally VITE_API_URL is unset and same-origin paths work.
 */
const apiBaseUrl = import.meta.env.VITE_API_URL?.trim();

const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, "");

/** Absolute URL for a backend REST endpoint, e.g. "/api/upload-avatar". */
export function apiUrl(path: string): string {
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return apiBaseUrl ? `${trimTrailingSlashes(apiBaseUrl)}${suffix}` : suffix;
}

/**
 * Resolves a stored document URL (as returned by the upload endpoints, e.g.
 * "/uploads/payslips/…") into something the browser can open. Absolute URLs are
 * passed through untouched so an S3/CDN migration needs no change here.
 */
export function fileUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) return url;
  return apiUrl(url);
}
