import { LogoMark } from "../components/LogoMark.tsx";
import { ROUTES } from "../../effects/session.ts";
import { Spinner } from "./CardScreen.tsx";
import "./cards.css";

// The page at `/p/:token`. A browser that already holds this link's session goes straight to `/s/:sessionId` without
// claiming again (C4). Otherwise it claims the link (`claimPairing`) and, on success, goes there too,
// so the owner normally sees only `claiming`. `refused` covers PairingLinkInvalid and AlreadyPaired;
// `over` covers SessionExpired and SessionEnded; `offline` means no usable reply. The browser persists its
// claimant key before the request so reloading recovers its own reservation even if only the reply was lost.
export type ClaimStatus = "claiming" | "refused" | "over" | "offline";

export const CLAIM = {
  claiming: "Opening your session…",
  refused: ["This link no longer works", "It was already used. Ask your agent for a new link."],
  over: ["This session is over", "Ask your agent to start a new session."],
  offline: ["Could not reach AgentPager", "Check your connection, then reload this page."],
  home: "Go to your sessions",
} as const;

export function ClaimScreen({ status }: { status: ClaimStatus }) {
  const message = status === "claiming" ? null : CLAIM[status];
  return (
    <div className="ap-app ap-rich" data-theme="system">
      <div className="ap-base">
        <nav className="ap-nav" aria-label="Primary">
          <div className="ap-nav-left" />
          <div className="ap-nav-center">
            <h1 className="ap-brand">
              <LogoMark size={28} />
              AgentPager
            </h1>
          </div>
          <div className="ap-nav-right" />
        </nav>
        <main className="ap-scroll">
          <div className="ap-column">
            {message ? (
              <section className="ap-panel">
                <h2>{message[0]}</h2>
                <p>{message[1]}</p>
                <a className="ap-primary" href={ROUTES.homeApp.path}>
                  {CLAIM.home}
                </a>
              </section>
            ) : (
              <p className="ap-loading" role="status">
                <Spinner />
                {CLAIM.claiming}
              </p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
