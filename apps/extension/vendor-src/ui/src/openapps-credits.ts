/**
 * `<openapps-credits>` — the user's balance, kept current.
 *
 * Refreshes on session changes (so a login or a confirmed top-up updates it
 * without the host wiring anything) and, optionally, on a poll interval for
 * apps where credits are spent by a backend the page cannot observe.
 */
import { css, html, nothing, type TemplateResult } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { OpenAppsElement } from "./base.js";

@customElement("openapps-credits")
export class OpenAppsCredits extends OpenAppsElement {
  /** Seconds between background refreshes. 0 (the default) disables them. */
  @property({ type: Number, attribute: "poll-seconds" }) pollSeconds = 0;

  /** Text shown before the label, e.g. "Balance". */
  @property({ type: String }) label = "Credits";

  @state() private balance: number | null = null;
  #timer?: ReturnType<typeof setInterval>;

  override connectedCallback(): void {
    super.connectedCallback();
    void this.refresh();
    if (this.pollSeconds > 0) {
      this.#timer = setInterval(() => void this.refresh(), this.pollSeconds * 1000);
    }
  }

  override disconnectedCallback(): void {
    if (this.#timer) clearInterval(this.#timer);
    super.disconnectedCallback();
  }

  protected override onSessionChange(): void {
    void this.refresh();
  }

  /** Public so a host can force a refresh after spending credits itself. */
  async refresh(): Promise<void> {
    // Reached before any client exists in two ordinary ways: the element
    // refreshes on connect, which on a plain HTML page happens before the
    // module script calls configure(); and a host may call this method
    // itself at any time. Touching `this.sdk` here would throw out of an
    // un-awaited promise, so read it defensively — with no client there is
    // simply no balance to show yet, and configure() notifies us to retry.
    const sdk = this.sdkOrNull;
    if (!sdk?.isLoggedIn) {
      this.balance = null;
      return;
    }
    const balance = await this.run(() => sdk.credits.balance());
    if (balance !== undefined) this.balance = balance;
  }

  override render(): TemplateResult {
    if (!this.sdkOrNull) return html`<span class="muted">…</span>`;
    if (!this.sdk.isLoggedIn) return html`<span class="muted">Not signed in</span>`;
    return html`
      <span class="wrap">
        <span class="label muted">${this.label}</span>
        <span class="value" aria-live="polite"
          >${this.balance === null ? "…" : this.balance.toLocaleString()}</span
        >
      </span>
      ${this.error ? html`<span class="error" role="alert">${this.error}</span>` : nothing}
    `;
  }

  static override styles = [
    OpenAppsElement.baseStyles,
    css`
      :host {
        display: inline-block;
      }
      .wrap {
        display: inline-flex;
        align-items: baseline;
        gap: 0.4em;
      }
      .label {
        font: var(--type-eyebrow, 500 12px/1.2 "Geist", system-ui, sans-serif);
        letter-spacing: var(--tracking-caps, 0.08em);
        text-transform: uppercase;
        color: var(--text-faint, var(--fb-faint));
      }
      /* A balance is a quantity, so it is set in mono. Tabular figures also
         stop the number jittering sideways as it ticks over on poll. */
      .value {
        font-family: var(--font-mono, "Geist Mono", ui-monospace, monospace);
        font-variant-numeric: tabular-nums;
        font-weight: var(--weight-medium, 500);
        color: var(--text-strong, var(--fb-strong));
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    "openapps-credits": OpenAppsCredits;
  }
}
