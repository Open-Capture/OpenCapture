# `@openapps/ui`

Drop-in web components over [`@openapps/sdk`](../sdk/ts): sign-in, a
balance, spending history, a credit store, and account management. Built
with Lit; styles live in shadow DOM, so they cannot break your page and your
page cannot break them.

```sh
npm install @openapps/ui @openapps/sdk
```

```html
<script type="module">
  import { configure } from "@openapps/ui";
  configure({ baseUrl: "https://accounts.example.com" });
</script>

<openapps-login></openapps-login>
<openapps-credits poll-seconds="30"></openapps-credits>
<openapps-history></openapps-history>
<openapps-buy></openapps-buy>
```

They share one client, so signing in with `<openapps-login>` refreshes the
balance in `<openapps-credits>` and unlocks `<openapps-buy>` — no glue code.

## The elements

**`<openapps-login>`** — offers every method the *server* has configured,
asked for via `/v1/auth/methods`. It deliberately does **not** hide a button
because no extension was detected: providers inject at unpredictable times,
and multi-chain wallets may register Nostr long after first render, so
availability is checked when the user clicks. Handles the
challenge/sign/verify round trip, completes OAuth redirects, and picks up
`?ref=CODE` to attribute the signup. Emits `openapps-login` / `openapps-logout`.

Nostr has two fallbacks for when no NIP-07 extension answers, offered in
that order because the first is safer:

**Remote signer (NIP-46).** The user pastes a `bunker://…` connection
string, or a NIP-05 name, from Amber, nsec.app or their own bunker. Their
key never leaves the signer — only the request travels, over a relay, and
they approve it on the signing device. This needs nothing injected into the
page, so it works identically in a web page, a Chrome extension and a
native app; on mobile, where no extension can exist, it is the only real
option. Bunkers that require a browser approval surface the link rather
than stalling, and a request that goes unanswered times out after a minute
instead of hanging the UI.

**A pasted `nsec1…`**, one click further away. The key is decoded and used
to sign in the browser — never sent to the server, never stored, cleared
from the DOM afterwards — and the form says so next to a warning that an
nsec is the whole identity and cannot be rotated. It exists for testing and
for people with no signer at all.

Both load their crypto as **separate chunks**, fetched only if someone
opens the relevant form.

**`<openapps-account>`** — one account, every way of reaching it: the
balance, the connected identities, and buttons to add more. When the
identity being connected already belongs to a different account, the server
refuses with a `409` carrying that account's balance and this element asks
whether to combine them; on confirmation it retries with `merge`, moving
credits, history and referral earnings across. Emits
`openapps-identity-linked` / `openapps-identity-unlinked`.

**`<openapps-credits>`** — the balance, refreshed on session changes and
optionally on a `poll-seconds` interval. Shows "Not signed in" rather than a
zero, because those mean different things.

**`<openapps-history>`** — where the credits went. A balance answers "how
many"; this answers "on what", grouping spending by product and feature
(`OpenCapture · watermark`) and then listing the entries themselves, with
"Show earlier" to page back. Both halves of that label come from the ledger:
the app id is attached from the key that charged, and the feature is the
`reason` the app passed to `deduct` — so **name your reasons for the person
reading them**.

Its summary describes exactly the entries loaded and says which: "recent
activity" until the server reports no further pages, then "all time".
Totalling a first page and calling it all-time would be a claim the user
cannot check. Set `app-id` to show only your own app's spending — but on a
shared account page, don't: the account spans every OpenApps app, and
filtering leaves a user watching a balance drop for reasons the page will
not name.

**`<openapps-buy>`** — packages, then rails, then payment instructions
(checkout redirect, deposit address, or BOLT11), then polls until the
top-up is confirmed. Emits `openapps-topup`. Limit the rails with
`rails="lightning,stripe"`.

`return-to` decides where card checkout comes back to: empty (default) is
this page, `none` ends on the server's own confirmation page — for a host
that cannot be redirected to, which is every browser extension. The
`openapps-checkout` event is cancelable, so a host that must not navigate
its own window can open the URL itself:

```js
buy.addEventListener("openapps-checkout", (e) => {
  e.preventDefault();
  chrome.tabs.create({ url: e.detail.url });
});
```

All events bubble and are composed, so one listener on `document` catches
them all.

## Attributes

| Attribute | Elements | Meaning |
|---|---|---|
| `base-url` | all | Server URL, if you did not call `configure()`. |
| `poll-seconds` | `<openapps-credits>` | Background refresh interval; `0` (default) disables. |
| `label` | `<openapps-credits>` | Text before the number. |
| `rails` | `<openapps-buy>` | Comma-separated allow-list of rails to offer. |
| `return-to` | `<openapps-buy>` | Where card checkout returns. Empty = this page; `none` = the server's own page. |
| `app-id` | `<openapps-history>` | Show only this app's spending. Omit on a shared account page. |
| `page-size` | `<openapps-history>` | Entries fetched per page (default 25). |
| `no-summary` | `<openapps-history>` | Entries only, without the per-feature breakdown. |

Assign `.client` in JavaScript to point one element at a different server.

## Using it without a bundler

`dist/bundle/` holds browser-ready builds with every dependency inlined.
Take the whole set, or just the element you need:

```html
<script type="module" src="…/@openapps/ui/dist/bundle/openapps-ui.js"></script>
<script type="module" src="…/@openapps/ui/dist/bundle/openapps-credits.js"></script>
```

Every element together is ~26 KB gzipped; one on its own is ~14–19 KB, most
of which is Lit and the SDK. A page that only wants a balance badge should
not be paying for the sign-in flow, which is what the per-element builds are
for. The Nostr key-signing crypto is a dynamic import in both, fetched only
if a user opens that form.

## Theming

The elements render in the OpenApps design system. Link the tokens once and
they pick them up — custom properties pierce shadow DOM, which is the seam:

```html
<link rel="stylesheet" href="node_modules/@openapps/tokens/tokens.css" />
```

Without that link they still render correctly against inlined fallbacks, so a
bare page is never broken — only unbranded.

Override any **semantic** token above the element to re-skin:

```css
openapps-buy {
  --brand: #0f766e;
  --radius-lg: 4px;
}
```

`--brand`, `--surface-card`, `--border-hairline`, `--text-strong`,
`--text-muted`, `--danger-fg`, `--radius-lg`, `--font-sans`. Do not reach for
a ramp entry such as `--green-500`; naming a hue inside a product surface is
what stops the system being re-skinnable.

Dark mode is **yours to control**: put `oa-auto` on `<html>` to follow the OS,
or `oa-dark` on any container to force it. The elements deliberately run no
`prefers-color-scheme` query of their own — one that did would sit stuck in
light inside a host that had forced dark. Only the no-tokens fallback palette
follows the OS, since in that case nothing else can decide.

## Provider marks

The sign-in buttons carry the real Google, Ethereum and Nostr marks, inlined
as SVG. Inline rather than fetched because Manifest V3 blocks remote images,
so an extension could not load them otherwise.

| Mark | Source |
|---|---|
| Google | The official four-colour G at its published geometry. Google's identity guidelines require the real mark. |
| Ethereum | The diamond, drawn as pure geometry. |
| Nostr | Traced from [SovrynMatt/Nostr-Website-Button-Design][nostr], which publishes raster only. Verified at 0.976 IoU against the source silhouette. That repository states everything in it is FOSS and free to use. |

[nostr]: https://github.com/SovrynMatt/Nostr-Website-Button-Design

## CORS

The browser calls the API cross-origin, so your page's origin must be in the
server's `allowed_origins`. With none configured the server sends no CORS
headers and every call fails before it reaches a route.
