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
const stripeBuyCard = document.getElementById("stripeBuyCard")!;
const stripePackagesEl = document.getElementById("stripePackages")!;

document.getElementById("signInGoogle")!.addEventListener("click", () => {
  // No `returnTo`: the server answers with the session as JSON instead of
  // redirecting anywhere, which is what openapps-callback/index.ts expects
  // to find and relay to background.ts. See that file and
  // background/index.ts's "openapps:session" listener for the rest of the
  // handoff.
  ext.tabs.create({ url: openappsClient.auth.googleStartUrl() });
});

async function renderStripePackages(): Promise<void> {
  try {
    const { packages } = await openappsClient.payments.packages();
    stripePackagesEl.replaceChildren(
      ...packages.map((pkg) => {
        const btn = document.createElement("button");
        btn.className = "btn btn-secondary btn-full";
        btn.textContent = `${pkg.credits.toLocaleString()} credits — $${(pkg.usd_price / 100).toFixed(2)}`;
        btn.addEventListener("click", async () => {
          btn.disabled = true;
          try {
            // returnTo: null lands the browser on the server's own
            // confirmation page instead of trying to redirect back here —
            // the same chrome-extension:// redirect Chrome blocks for
            // sign-in above applies just as much to a Stripe return URL.
            // The new tab is where checkout happens; this page just opens
            // it and lets <openapps-credits>'s poll pick up the new
            // balance once the payment settles.
            const { checkout_url } = await openappsClient.payments.stripeCheckout(pkg.id, { returnTo: null });
            ext.tabs.create({ url: checkout_url });
          } finally {
            btn.disabled = false;
          }
        });
        return btn;
      }),
    );
  } catch (err) {
    stripePackagesEl.textContent = err instanceof Error ? err.message : String(err);
  }
}

(async () => {
  await openappsReady;
  signInCard.hidden = openappsClient.isLoggedIn;
  stripeBuyCard.hidden = !openappsClient.isLoggedIn;
  await renderStripePackages();
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
