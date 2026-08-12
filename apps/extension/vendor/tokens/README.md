# @openapps/tokens

The OpenApps design tokens as plain CSS: colour, type, spacing, geometry,
elevation, motion, and the Geist faces. No components, no framework, no
JavaScript — so an app can match the account panel without adopting Lit, and
a Svelte or vanilla app can use the same variables for its own UI.

Generated from the `openapps-design` system. That system is the source of
truth for *what* the values are; this package is only how they reach a
product.

## Which file to link

```html
<!-- Embedding a OpenApps panel in your own app -->
<link rel="stylesheet" href="node_modules/@openapps/tokens/tokens.css" />

<!-- A page OpenApps owns end to end -->
<link rel="stylesheet" href="node_modules/@openapps/tokens/styles.css" />
```

`tokens.css` declares **custom properties and `@font-face` only**, so linking
it cannot restyle a single element you own. `styles.css` adds the base layer —
resets, and defaults for `body`, headings, links, lists and focus rings — which
is right for a page we own and wrong inside somebody else's application.

Getting this backwards is the one real hazard here: `styles.css` in a host app
silently redesigns that app around our card.

## Dark mode

Put `oa-auto` on `<html>` to follow the OS, or `oa-dark` on any container to
force it. Both only re-point variables, so they compose with whatever the host
already does.

```html
<html class="oa-auto">
```

Components should **not** run their own `prefers-color-scheme` query. A host
that forces dark on a light OS would then get a component stuck in light —
read the semantic tokens instead and let the container decide.

## Using the values

Three layers exist. Only the third belongs in product code:

| Layer | Example | Use it? |
|---|---|---|
| Brand palette, verbatim | `--green-500` | No |
| Derived ramps | `--gray-200` | No |
| Semantic aliases | `--surface-card`, `--text-muted`, `--border-hairline` | **Yes** |

Referencing layer 1 or 2 hard-codes a hue into a component, which is exactly
what stops the system being re-skinnable.

```css
.card {
  background: var(--surface-card);
  border: var(--border-width) solid var(--border-hairline);
  border-radius: var(--radius-lg);
  color: var(--text-body);
  font: var(--type-body);
}
```

Anything numeric — balances, prices, per-unit rates, ledger amounts — is set
in mono: `font: var(--type-mono)`.

## The fonts

The design system ships 24 OTF faces totalling 3.9 MB. Three are shipped here,
latin-subset as WOFF2, **41 KB in total**:

| Face | Why | Size |
|---|---|---|
| Geist 400 | Body | 14 KB |
| Geist 500 | UI, labels, the wordmark | 15 KB |
| Geist Mono 400 | Everything numeric | 12 KB |

That is the whole set the product rules can reach — "product UI uses only 400
and 500", and mono carries the numbers. Weights 300 and 700 are editorial; a
marketing page should link the design system's own stylesheet rather than
pulling more weight into an SDK. A component that asks for 600 or 700 gets a
synthesised bold, which is a deliberate signal it has left the product scale.

Fonts are self-hosted rather than fetched from a CDN because Manifest V3
blocks remote font loads — an extension could not use them otherwise.

To regenerate after a design-system update, re-run the subsetting step in
`scripts/` with `fonttools` and `brotli` installed.
