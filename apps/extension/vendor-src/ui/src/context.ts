/**
 * One client, shared by every element on the page.
 *
 * Elements are dropped into HTML, often by someone who never writes a line
 * of JavaScript, so they cannot be handed a client by a parent component.
 * The host configures once — in a script tag or via the `base-url`
 * attribute on any element — and everything else resolves the same
 * instance, which matters because the session lives inside it.
 */
import { OpenApps, type OpenAppsOptions } from "@openapps/sdk";

let shared: OpenApps | null = null;

/** Configure the shared client. Call once, before the elements render. */
export function configure(options: OpenAppsOptions): OpenApps {
  shared = new OpenApps(options);
  notify();
  return shared;
}

/** The shared client, if one has been configured or derived from an attribute. */
export function getClient(): OpenApps | null {
  return shared;
}

/**
 * Resolve the client an element should use: an explicitly assigned one, the
 * shared one, or a new shared one built from a `base-url` attribute.
 */
export function resolveClient(explicit?: OpenApps, baseUrl?: string): OpenApps {
  if (explicit) return explicit;
  if (shared) return shared;
  if (baseUrl) return configure({ baseUrl });
  throw new Error(
    "no OpenApps client: call configure({ baseUrl }) or set base-url on the element",
  );
}

// --- session change fan-out ---------------------------------------------

const listeners = new Set<() => void>();

/**
 * Subscribe to "something about the session or balance may have changed".
 * Deliberately payload-free: elements re-read what they need, so a login in
 * one element refreshes the balance in another without them knowing about
 * each other.
 */
export function onChange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notify(): void {
  for (const listener of listeners) listener();
}

/** Tests only: forget the shared client so ordering can be exercised. */
export function resetClient(): void {
  shared = null;
}
