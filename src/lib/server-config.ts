/**
 * Server-only configuration. Do not import from client components — the values
 * here are read from process.env at request time and are not available in the
 * browser bundle.
 */

/**
 * Origin used for server-side fetches of this app's own API.
 *
 * This deliberately does NOT use a NEXT_PUBLIC_* variable. Those are inlined
 * into the bundle at build time, so the value freezes at whatever the building
 * host had and any `||` fallback beside it becomes dead code — a build made
 * while NEXT_PUBLIC_BASE_URL pointed at :3002 sent the :3004 instance's own
 * requests to :3002. It is also a purely internal address that has no business
 * being shipped to the browser.
 *
 * Read at request time instead, defaulting to the port this process is actually
 * serving, so one build works unchanged on every instance. INTERNAL_BASE_URL
 * overrides it if the app ever needs to reach its API somewhere other than
 * loopback.
 */
export function internalBaseUrl(): string {
  const explicit = process.env.INTERNAL_BASE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, '');
  return `http://127.0.0.1:${process.env.PORT || 3000}`;
}
