# `@openapps/sdk`

Zero-dependency TypeScript client for a OpenApps server. ~5.5 KB gzipped,
runs anywhere there is `fetch`: browsers, Node 18+, Chrome extensions
(MV3), Deno, Bun, Tauri.

```sh
npm install @openapps/sdk
```

```ts
import { OpenApps } from "@openapps/sdk";

const openapps = new OpenApps({ baseUrl: "https://accounts.example.com" });

// Wallet login
const { challenge_id, message } = await openapps.auth.challenge("eip155", address);
const signature = await wallet.request({
  method: "personal_sign",
  params: [message, address],
});
await openapps.auth.verify(challenge_id, { type: "signature", signature });

// Everything afterwards is authenticated automatically
console.log(await openapps.credits.balance());
```

## What it handles for you

**Sessions.** `verify` stores the tokens; every later call attaches them. A
401 triggers one refresh and a retry, and concurrent 401s share a single
refresh — important, because replaying a rotated refresh token is treated as
theft and revokes the whole family.

**Errors.** Every failure is an `OpenAppsError` with a stable `code`
(`insufficient_balance`, `unauthorized`, `rate_limited`, `network`, …), so
you branch on a string rather than on status codes or message text.

```ts
try {
  await openapps.credits.deduct(100, "export", jobId);
} catch (error) {
  if (error.code === "insufficient_balance") showTopUp(error.balance);
}
```

**Payment polling.** Every rail settles out-of-band, so the client's job is
to watch the status. `waitFor` polls until the top-up is terminal and keeps
going through dropped connections, because a failed poll says nothing about
the payment.

```ts
const { topup_id, bolt11 } = await openapps.payments.lightningInvoice("starter");
showInvoice(bolt11);
const topup = await openapps.payments.waitFor(topup_id);
if (topup.status === "confirmed") celebrate();
```

## Token storage

Defaults to `localStorage` in browsers (so a reload keeps the session) and
memory elsewhere. Refresh tokens are opaque, single-use and rotated, which
is what makes that tolerable — but they are still readable by any script on
the page. Pass your own `TokenStore` if you need better:

```ts
new OpenApps({ baseUrl, store: memoryStore() });
new OpenApps({ baseUrl, store: myChromeStorageStore });
```

## App keys

`credits.deduct` needs an app key and acts on behalf of a signed-in user.
**Keep it server-side.** A key in a browser bundle lets any visitor charge
any logged-in user.

## Scripts

| Command | What |
|---|---|
| `npm run build` | Compile to `dist/` (ESM + declarations). |
| `npm test` | Vitest suite against a mocked `fetch`. |
| `npm run size` | Enforce the 10 KB gzipped budget. |
