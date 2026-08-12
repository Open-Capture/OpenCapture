/**
 * `<openapps-referral>` — your invite link, and what it has earned.
 *
 * The server has carried referrals since the first migration, but nothing
 * ever showed a user their own code, so the feature was unreachable in
 * practice: a referral program nobody can see the link for does not run.
 *
 * The share link is built from the *host page's* URL rather than a
 * configured one. Whichever app a user is in is the app they want to invite
 * someone to, and hard-coding a canonical destination would send every
 * invite to the wrong product.
 */
import { type TemplateResult } from "lit";
import { OpenAppsElement } from "./base.js";
export declare class OpenAppsReferral extends OpenAppsElement {
    /**
     * Where invited people should land. Defaults to the current page, minus
     * any query or fragment — a link built from a URL that already carried
     * `?ref=` would otherwise compound one code onto another.
     */
    inviteUrl?: string;
    private info;
    private earnings;
    private referees;
    private tab;
    private copied;
    connectedCallback(): void;
    protected onSessionChange(): void;
    private load;
    private get link();
    private copy;
    render(): TemplateResult;
    private renderLink;
    private renderReferees;
    private renderEarnings;
    static styles: import("lit").CSSResult[];
}
declare global {
    interface HTMLElementTagNameMap {
        "openapps-referral": OpenAppsReferral;
    }
}
//# sourceMappingURL=openapps-referral.d.ts.map