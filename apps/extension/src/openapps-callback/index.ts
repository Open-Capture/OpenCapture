// Content script, injected only on the OpenApps server's OIDC callback URL
// (see manifest.json's `content_scripts` entry — scoped to that one path,
// deliberately narrower than this extension's usual zero-standing-access
// posture, since this is the one origin that ever issues a session).
//
// That endpoint answers with JSON containing the session, which the
// browser renders as plain text. A page script cannot reach extension
// storage, so this reads the tokens off the rendered page and hands them
// to the background service worker, which is the only context that writes
// the session (see background/index.ts's "openapps:session" listener,
// which re-checks the sender's origin before trusting this).
//
// Runs as a classic script, not an ES module — MV3 content scripts always
// do — so this file must import nothing, mirroring content/index.ts's own
// constraint. Duplicating the `ext` alias inline here for the same reason.
(() => {
  const ext: typeof chrome = (globalThis as unknown as { browser?: typeof chrome }).browser ?? chrome;

  const text = document.body?.innerText ?? "";
  let payload: { access_token?: string; refresh_token?: string };
  try {
    payload = JSON.parse(text);
  } catch {
    return; // Not the JSON response — an error page, or a redirect landed here.
  }
  if (!payload.access_token || !payload.refresh_token) return;

  ext.runtime.sendMessage({
    type: "openapps:session",
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
  });

  // Replace the raw tokens on screen so they are not left sitting in a tab.
  document.body.textContent = "Signed in. You can close this tab.";
})();
