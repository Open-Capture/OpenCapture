// Content script, injected only on the OpenApps server URLs that ever hand
// out a session or need one (see manifest.json's `content_scripts` entry —
// deliberately narrower than this extension's usual zero-standing-access
// posture, since these are the only origins that ever touch a session).
//
// A page script cannot reach extension storage, so this relays tokens
// between the page and the background service worker, which is the only
// context that holds the session (see background/index.ts's
// "openapps:session" and "openapps:request-token" listeners, both of which
// re-check the sender's origin before trusting this).
//
// Three flows, two directions:
//
//   /signin                        — the server-hosted sign-in page, which
//     posts a *new* session OUT to its own window once the user has signed
//     in with Google, a wallet or Nostr. Exists because an extension page
//     never receives an injected `window.ethereum` or `window.nostr`:
//     Chrome only injects into http(s) pages, so wallet and Nostr sign-in
//     are impossible in our own window no matter what's installed.
//
//   /link                          — the linking counterpart: connecting a
//     *second* identity to an *already signed-in* account, for the same
//     injection reason as /signin. This one needs a token handed IN rather
//     than a session handed out — the page has no session of its own yet
//     to authenticate with, and chrome.storage is invisible to it.
//
//   …/oidc/google/callback         — the older Google-only path, which
//     answers with JSON the browser renders as text. Still handled: it is
//     what a caller that passes no `return_to` gets, and it costs four
//     lines to keep working.
//
// Runs as a classic script, not an ES module — MV3 content scripts always
// do — so this file must import nothing, mirroring content/index.ts's own
// constraint. Duplicating the `ext` alias inline here for the same reason.
(() => {
  const ext: typeof chrome = (globalThis as unknown as { browser?: typeof chrome }).browser ?? chrome;

  function relay(accessToken: string, refreshToken: string): void {
    ext.runtime.sendMessage({ type: "openapps:session", accessToken, refreshToken });
  }

  // The /link handoff, the reverse direction: the page asks for a token by
  // announcing readiness, and this asks the background worker for whatever
  // session is currently stored (no session at all just means the answer
  // is "no token" — /link's own page shows an explanatory error for that,
  // same as it does for a genuinely unreachable extension).
  if (location.pathname === "/link") {
    window.addEventListener("message", (event) => {
      if (event.source !== window || event.origin !== location.origin) return;
      const data = event.data as { source?: string; type?: string } | undefined;
      if (data?.source !== "openapps-host" || data.type !== "openapps-link:ready") return;
      ext.runtime.sendMessage({ type: "openapps:request-token" }, (response: { accessToken?: string } | undefined) => {
        if (!response?.accessToken) return;
        window.postMessage({ source: "openapps-extension", type: "openapps-link:token", accessToken: response.accessToken }, location.origin);
      });
    });
    return; // /link never hands out a session — nothing below applies to it.
  }

  // The /signin handoff. A content script shares the page's window, so a
  // page-to-self postMessage reaches here — and only here: it is targeted
  // at the page's own origin, so no opener, parent or other site can read
  // it. Both guards matter. `source !== window` rejects anything posted by
  // a frame, and the origin check rejects a message forged by an embedded
  // document on another origin.
  window.addEventListener("message", (event) => {
    if (event.source !== window || event.origin !== location.origin) return;
    const data = event.data as
      | { source?: string; type?: string; access_token?: string; refresh_token?: string }
      | undefined;
    if (data?.source !== "openapps" || data.type !== "openapps:session") return;
    if (!data.access_token || !data.refresh_token) return;
    relay(data.access_token, data.refresh_token);
  });

  // Content scripts are injected at document_idle, and the page can finish
  // signing in before that — a Google return only has to complete one token
  // exchange. Announcing readiness makes the page re-send anything it has
  // already delivered, so the ordering stops mattering.
  window.postMessage({ source: "openapps-host", type: "ready" }, location.origin);

  // The Google-callback handoff: the endpoint's JSON body, rendered as text.
  const text = document.body?.innerText ?? "";
  let payload: { access_token?: string; refresh_token?: string };
  try {
    payload = JSON.parse(text);
  } catch {
    return; // Not the JSON response — the sign-in page, an error, a redirect.
  }
  if (!payload.access_token || !payload.refresh_token) return;

  relay(payload.access_token, payload.refresh_token);

  // Replace the raw tokens on screen so they are not left sitting in a tab.
  document.body.textContent = "Signed in. You can close this tab.";
})();
