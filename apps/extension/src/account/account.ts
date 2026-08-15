// Full OpenApps account page: sign-in, balance, connected identities, and
// buying credits. Opened in its own tab from the popup (see popup.ts) —
// popups are torn down on blur, so a real sign-in redirect or a checkout
// flow can't live inside one; this mirrors editor.html's own reason for
// being a separate tab rather than living inside the popup.
import "@openapps/tokens/tokens.css";
import { configure } from "@openapps/ui";
import { client as openappsClient, ready as openappsReady, store as openappsStore } from "../chrome/openapps-session";
import { ext } from "../platform/webext";

// Shares the same chrome.storage.session-backed store as background.ts's
// own client (see openapps-session.ts) rather than letting configure()
// build a fresh one — otherwise this page and the background service
// worker would each think the other was signed out.
//
// Called synchronously, not behind an `await ready` — the elements can
// upgrade and call into the client the instant they connect, and
// `configure()` is documented as "call once, before the elements render".
// The store itself is safe to hand over before it finishes hydrating from
// chrome.storage (that's the whole point of asyncBackedStore): it starts
// as "no session", then updates and notifies once the persisted one loads.
configure({ baseUrl: "https://accounts.openapps.network", store: openappsStore });

// background.ts adopts a session into this same store from a completely
// different tab (the OAuth callback one — see openapps-callback/index.ts),
// with no way to tell *this* page's already-constructed client that
// happened. A full reload is blunt but correct: it re-reads the
// now-updated store from scratch, for both the hand-rolled bits below and
// every <openapps-*> element on the page. (Change events live on the
// top-level chrome.storage.onChanged, not per-area — filter by areaName.)
ext.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === "session" && "openapps.session" in changes) location.reload();
});

const signInCard = document.getElementById("signInCard")!;
const buyEl = document.querySelector("openapps-buy")!;
const signOutBtn = document.getElementById("signOut") as HTMLButtonElement;

document.getElementById("signIn")!.addEventListener("click", () => {
  // The server's own sign-in page, in its own tab. It is an https origin,
  // so a wallet or Nostr extension actually injects into it — neither will
  // ever appear in this window — and it hands the session back through
  // openapps-callback/index.ts. See background/index.ts's
  // "openapps:session" listener for the rest of the handoff.
  ext.tabs.create({ url: new URL("/signin", openappsClient.baseUrl).toString() });
});

// <openapps-buy> would navigate this window to Stripe, which for an
// extension page means destroying it mid-purchase. Taking the event over
// keeps the account page and puts checkout in its own tab; the balance
// updates on <openapps-credits>'s next poll once the payment settles.
buyEl.addEventListener("openapps-checkout", (event) => {
  const { url } = (event as CustomEvent<{ url: string }>).detail;
  event.preventDefault();
  ext.tabs.create({ url });
});

// The session lives in chrome.storage.session, shared with the background
// worker, so signing out has to clear it there rather than just in this
// page's memory — which is what the SDK's logout does via the store passed
// to configure(). The storage change then reloads this page through the
// listener above, so there is no separate re-render here.
//
// The SDK revokes server-side and clears locally in a `finally`, so a
// failed request still ends with this device signed out; the catch is only
// so the button recovers instead of leaving a rejected promise behind.
signOutBtn.addEventListener("click", async () => {
  signOutBtn.disabled = true;
  try {
    await openappsClient.auth.logout();
  } catch (err) {
    console.warn("[openapps] sign-out request failed; cleared locally anyway", err);
  } finally {
    signOutBtn.disabled = false;
    render();
  }
});

function render(): void {
  signInCard.hidden = openappsClient.isLoggedIn;
  signOutBtn.hidden = !openappsClient.isLoggedIn;
}

(async () => {
  await openappsReady;
  render();
})();

document.getElementById("closeAccount")!.addEventListener("click", async () => {
  // Same reasoning as editor.ts's closeEditor handler: this tab was opened
  // via ext.tabs.create(), not window.open(), so window.close() alone can
  // silently no-op.
  const tab = await ext.tabs.getCurrent();
  if (tab?.id !== undefined) {
    await ext.tabs.remove(tab.id);
  } else {
    window.close();
  }
});
