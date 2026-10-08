import { useEffect, useMemo, useRef, useState } from "react";
import { useMachine } from "@xstate/react";
import type { Layer } from "effect";
import type { HomeApi } from "../../effects/cards.ts";
import { ROUTES } from "../../effects/session.ts";
import { createHomeMachine, type HomeEvent, type HomeSnapshot } from "../../machines/home.ts";
import type { LiveHomeSession, EndedHomeSession, Token } from "../../schemas/exchange.ts";
import { LogoMark } from "../components/LogoMark.tsx";
import { QrPicture } from "../components/QrPicture.tsx";
import { CopyIcon } from "../components/CopyIcon.tsx";
import { Chevron, Close, Spinner, Tray } from "./CardScreen.tsx";
import { connectUrl } from "./StartScreen.tsx";
import "./cards.css";

// The home screen's words. A check reads these back.
export const HOME = {
  brand: "AgentPager",
  active: "Active",
  ended: "Ended",
  empty: "No sessions on this phone. Tap + to connect an agent.",
  unpaired: "Unpaired",
  finished: "Agent finished",
  connect: "Connect an agent",
  scan: "Scan the QR code your agent shows with your phone’s camera.",
  giveLink: "Or give your agent this link",
  making: "Making your link…",
  copy: "Copy",
  copied: "Copied",
  close: "Close",
  offline: "Can’t reach AgentPager. Trying again.",
  stale: "Updates paused. Your connection may be offline.",
  failed: "Could not load your sessions",
} as const;

const ago = (at: string, now: number) => {
  const minutes = Math.max(0, Math.round((now - Date.parse(at)) / 60_000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}h ago` : new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

function Rows({ sessions, now }: { sessions: ReadonlyArray<LiveHomeSession>; now: number }) {
  if (!sessions.length) return null;
  return (
    <section aria-label={HOME.active}>
      <h2 className="ap-section-label">{HOME.active}</h2>
      <div className="ap-group">
        {sessions.map((s) => (
          <a className="ap-row ap-session-row" key={s.sessionId} href={ROUTES.phoneApp.path.replace(":sessionId", s.sessionId)}>
            <span className={"ap-dot" + (s.status === "finished" ? " ap-dot-finished" : s.status === "active" ? "" : " ap-dot-waiting")} aria-hidden="true" />
            <span className="ap-row-text">
              <strong>{s.name}</strong>
              <small>{s.status === "unpaired" ? `${HOME.unpaired} · ${ago(s.lastActivityAt, now)}` : s.status === "finished" ? `${HOME.finished} · ${ago(s.lastActivityAt, now)}` : ago(s.lastActivityAt, now)}</small>
            </span>
            {s.openCount > 0 && (
              <span className="ap-badge">
                {s.openCount}
                <span className="ap-visually-hidden"> open</span>
              </span>
            )}
            <Chevron />
          </a>
        ))}
      </div>
    </section>
  );
}

// Terminal rows are local labels, not links to forgotten service identities (C8).
function EndedRows({ sessions, now }: { sessions: ReadonlyArray<EndedHomeSession>; now: number }) {
  const [selected, setSelected] = useState<EndedHomeSession | null>(null);
  if (!sessions.length) return null;
  return <>
    <section aria-label={HOME.ended}>
      <h2 className="ap-section-label">{HOME.ended}</h2>
      <div className="ap-group">{sessions.map((s, index) => <button className="ap-row ap-session-row" key={index} onClick={() => setSelected(s)}>
        <span className="ap-dot ap-dot-ended" aria-hidden="true" />
        <span className="ap-row-text"><strong>{s.name}</strong><small>{ago(s.endedAt, now)}</small></span><Chevron />
      </button>)}</div>
    </section>
    {selected && <Tray title={selected.name} onClose={() => setSelected(null)}>
      <div className="ap-receipt"><h2>{selected.name}</h2><p>Session ended</p><p>{ago(selected.endedAt, now)}. The session’s decisions have been cleared.</p>
        <button className="ap-primary" onClick={() => setSelected(null)}>Close</button>
      </div>
    </Tray>}
  </>;
}

// What the owner does with an agent's QR code: point the phone's camera at it.
function ScanPicture() {
  return (
    <div className="ap-scan" aria-hidden="true">
      <QrPicture className="ap-scan-code" />
      <span className="ap-scan-line" />
    </div>
  );
}

const PlusIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
    <path d="M12 4v16M4 12h16" />
  </svg>
);

function ConnectSheet({
  snapshot,
  send,
  copyText,
}: {
  snapshot: HomeSnapshot;
  send: (event: HomeEvent) => void;
  copyText: (text: string) => Promise<void>;
}) {
  const c = snapshot.context,
    url = c.connectId && connectUrl(c.connectId),
    [status, setStatus] = useState(""),
    link = useRef<HTMLSpanElement>(null);
  // The link changes as the phone makes new ids; "Copied" belongs to the one copied.
  useEffect(() => setStatus((s) => (s === HOME.copied ? "" : s)), [url]);
  return (
    <Tray title={HOME.connect} onClose={() => send({ type: "BACK" })}>
      <div className="ap-connect">
        <header className="ap-sheet-head">
          <h2 tabIndex={-1} data-autofocus>
            {HOME.connect}
          </h2>
          <button className="ap-round ap-close" aria-label={HOME.close} onClick={() => send({ type: "BACK" })}>
            <Close />
          </button>
        </header>
        <p className="ap-lead">{HOME.scan}</p>
        <ScanPicture />
        <div className="ap-give-link">
          <span id="ap-give-label">{HOME.giveLink}</span>
          <div className="ap-link-field" aria-labelledby="ap-give-label" role="group">
            <span className="ap-link-text" ref={link}>{url ?? HOME.making}</span>
            <button
              className="ap-link-copy"
              disabled={!url}
              onClick={() => {
                if (!url) return;
                setStatus("");
                if (link.current) window.getSelection()?.selectAllChildren(link.current);
                copyText(url).then(() => setStatus(HOME.copied), () => {});
              }}
            >
              <CopyIcon />
              {status === HOME.copied ? HOME.copied : HOME.copy}
            </button>
          </div>
        </div>
        {c.offline && <p className="ap-warning" role="alert">{HOME.offline}</p>}
        <span className="ap-visually-hidden" role="status" aria-live="polite">
          {status}
        </span>
      </div>
    </Tray>
  );
}

// The page at `/app`: every session this browser holds, newest activity first.
export function HomeScreen({
  snapshot,
  send,
  now = Date.now(),
  copyText = (text) => navigator.clipboard.writeText(text),
}: {
  snapshot: HomeSnapshot;
  send: (event: HomeEvent) => void;
  now?: number;
  copyText?: (text: string) => Promise<void>;
}) {
  const c = snapshot.context,
    sessions = c.sessions ?? [],
    connect = !snapshot.matches({ list: "browse" }) && snapshot.matches("list"),
    live = sessions.filter((s): s is LiveHomeSession => "sessionId" in s),
    over = sessions.filter((s): s is EndedHomeSession => "endedAt" in s);
  return (
    <div className="ap-app ap-rich" data-theme="system">
      <div className="ap-base" inert={connect}>
        <nav className="ap-nav" aria-label="Primary">
          <div className="ap-nav-left" />
          <div className="ap-nav-center">
            <h1 className="ap-brand">
              <LogoMark size={28} />
              {HOME.brand}
            </h1>
          </div>
          <div className="ap-nav-right" />
        </nav>
        <main className="ap-scroll">
          <div className="ap-column">
            {snapshot.matches("loading") && (
              <p className="ap-loading" role="status">
                <Spinner />
                Loading your sessions…
              </p>
            )}
            {snapshot.matches("failed") && (
              <section className="ap-panel">
                <h2>{HOME.failed}</h2>
                <p>Your connection may be offline.</p>
                <button className="ap-primary" onClick={() => send({ type: "RETRY" })}>
                  Retry
                </button>
              </section>
            )}
            {snapshot.matches("list") && (
              <>
                {c.stale && (
                  <p className="ap-warning" role="status">
                    {HOME.stale}
                  </p>
                )}
                <Rows sessions={live} now={now} />
                <EndedRows sessions={over} now={now} />
                {!sessions.length && (
                  <div className="ap-empty-state">
                    <LogoMark size={56} />
                    <p>{HOME.empty}</p>
                  </div>
                )}
              </>
            )}
          </div>
        </main>
        {/* Always on screen; it works once the session list has loaded. */}
        <button
          className="ap-fab"
          aria-label={HOME.connect}
          disabled={!snapshot.can({ type: "CONNECT" })}
          onClick={() => send({ type: "CONNECT" })}
        >
          <PlusIcon />
        </button>
      </div>
      {connect && <ConnectSheet snapshot={snapshot} send={send} copyText={copyText} />}
    </div>
  );
}

export function HomeApp({
  layer,
  now = Date.now,
  copyText,
  makeId,
  open = (path) => window.location.assign(path),
}: {
  layer: Layer.Layer<HomeApi>;
  now?: () => number;
  copyText?: (text: string) => Promise<void>;
  makeId?: () => Token;
  open?: (path: string) => void;
}) {
  const machine = useMemo(() => createHomeMachine(layer, makeId), [layer, makeId]);
  const [snapshot, send] = useMachine(machine);
  // An agent joined through the Connect sheet: its pairing card opens on the session's page (C9).
  const joined = snapshot.context.joined?.sessionId;
  useEffect(() => {
    if (joined) open(ROUTES.phoneApp.path.replace(":sessionId", joined));
  }, [joined]);
  return <HomeScreen snapshot={snapshot} send={send} now={now()} copyText={copyText} />;
}
