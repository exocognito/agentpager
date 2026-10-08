import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useMachine } from "@xstate/react";
import { Schema, type Layer } from "effect";
import type { CardApi } from "../../effects/cards.ts";
import {
  createCardMachine,
  currentCard,
  type CardContext,
  type CardEvent,
  type CardSnapshot,
} from "../../machines/cards.ts";
import {
  Choice,
  characters,
  BODY_MAX_CHARACTERS,
  PAIRING_RECOMMENDATION,
  SEND_RETRIES,
  UNDO_MS,
  type Decision,
} from "../../schemas/exchange.ts";
import { acceptsChoice } from "../components/cards/schemas.ts";
import { ROUTES } from "../../effects/session.ts";
import "./cards.css";
export const choiceText = (d: Decision, c: Choice) => {
  if (c.kind === "feedback") return c.text;
  const option = d.card.options.find((o) => o.number === c.number);
  return option ? `${option.emoji} ${option.title}` : `Option ${c.number}`;
};
export const answerText = (d: Decision) => (d.answer ? choiceText(d, d.answer.choice) : "");
// Short, local and without seconds: "Sep 30, 11:00 PM".
export const when = (at: string) =>
  new Date(at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
export const Close = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 12 12"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="m2 2 8 8m0-8-8 8" />
  </svg>
);
export const Chevron = () => (
  <svg
    width="8"
    height="14"
    viewBox="0 0 8 14"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="m1.5 1.5 5.5 5.5-5.5 5.5" />
  </svg>
);
const BackChevron = () => (
  <svg width="13" height="21" viewBox="0 0 13 21" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10.5 2.5 2.5 10.5l8 8" />
  </svg>
);
const FeedbackIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z" />
  </svg>
);
// A question's detail starts at four lines; Show more opens the rest when it runs longer.
function Detail({ text }: { text: string }) {
  const ref = useRef<HTMLParagraphElement>(null),
    [open, setOpen] = useState(false),
    [long, setLong] = useState(false);
  useLayoutEffect(() => {
    setOpen(false);
    const p = ref.current;
    if (!p) return;
    // Measure the four-line bound, even while expanded. Observe layout rather than
    // just text: a narrower sheet or a loaded font can introduce hidden lines.
    const measure = () => setLong(p.scrollHeight > parseFloat(getComputedStyle(p).lineHeight) * 4 + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(p);
    return () => observer.disconnect();
  }, [text]);
  return (
    <div className="ap-about">
      <p ref={ref} className={open ? "" : "ap-clamp"}>{text}</p>
      {long && (
        <button className="ap-more" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}
export const Spinner = () => <span className="ap-spinner" aria-hidden="true" />;
// A sheet over the screen. Focus starts on the element marked data-autofocus, else on the sheet itself, moves again when focusKey changes, and returns to the opener on close.
export function Tray({
  title,
  children,
  onClose,
  busy = false,
  decisionId,
  focusKey,
  className = "",
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
  decisionId?: Decision["decisionId"];
  focusKey?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    return () => {
      if (before?.isConnected) before.focus();
    };
  }, []);
  useEffect(() => {
    (ref.current?.querySelector<HTMLElement>("[data-autofocus]:not(:disabled)") ?? ref.current)?.focus();
  }, [decisionId, busy, focusKey]);
  return (
    <div className="ap-overlay">
      <button
        className="ap-backdrop"
        tabIndex={-1}
        aria-label="Close overlay"
        disabled={busy}
        onClick={onClose}
      />
      <div
        className={`ap-tray ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={ref}
        tabIndex={-1}
        onKeyDown={(e) => {
          if (e.key === "Escape" && !busy) {
            e.preventDefault();
            onClose();
          }
          if (e.key === "Tab") {
            const items = [
              ...ref.current!.querySelectorAll<HTMLElement>(
                "button,input,textarea,select,a[href],summary,[tabindex]",
              ),
            ].filter((item) => item.tabIndex >= 0 && !item.matches(":disabled") && item.getClientRects().length > 0);
            const first = items[0],
              last = items.at(-1);
            if (!items.length) {
              e.preventDefault();
              ref.current?.focus();
            } else if (e.shiftKey && (document.activeElement === first || !items.includes(document.activeElement as HTMLElement))) {
              e.preventDefault();
              last?.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <div className="ap-grabber" aria-hidden="true" />
        {children}
      </div>
    </div>
  );
}
const chosenOption = (d: Decision) => {
  const c = d.answer?.choice;
  return c?.kind === "option" ? d.card.options.find((o) => o.number === c.number) : undefined;
};
// The chosen option's emoji is on the row's mark, so the line names only its title.
const historyLine = (d: Decision) =>
  (d.status === "feedback" ? "Asked for changes" : (chosenOption(d)?.title ?? answerText(d))) +
  (d.acknowledgement ? "" : " · Waiting for your agent");
// A row's mark: empty while open; once answered, the chosen option's emoji, or a speech bubble for asked changes.
function RowMark({ d }: { d: Decision }) {
  const emoji = chosenOption(d)?.emoji;
  return (
    <span className={d.status === "open" ? "ap-mark ap-mark-open" : "ap-mark"} aria-hidden="true">
      {d.status === "feedback" ? <FeedbackIcon /> : emoji}
    </span>
  );
}
function Queue({
  context: c,
  send,
}: {
  context: CardContext;
  send: (event: CardEvent) => void;
}) {
  const inbox = c.inbox;
  if (!inbox) return null;
  return (
    <>
      {c.stale && (
        <p className="ap-warning" role="status">
          Updates paused. Your connection may be offline.
        </p>
      )}
      {inbox.session.finishedAt && (
        <p className="ap-finished" role="status">
          Your agent finished this session. Everything here stays readable until you end the session or it expires.
        </p>
      )}
      <section aria-labelledby="ap-open">
        <div className="ap-section-heading">
          <h2 id="ap-open" className="ap-section-label">Open decisions</h2>
          <span>{inbox.open.length} waiting</span>
        </div>
        <div className="ap-group">
          {inbox.open.map((d) => (
            <button
              className="ap-row ap-decision-row"
              key={d.decisionId}
              aria-haspopup="dialog"
              onClick={() => send({ type: "OPEN", decisionId: d.decisionId })}
            >
              <RowMark d={d} />
              <span className="ap-row-text">
                <strong>{d.title}</strong>
                {d.detail && <small>{d.detail}</small>}
              </span>
              <Chevron />
            </button>
          ))}
          {!inbox.open.length && (
            <p className="ap-empty">
              All caught up. New decisions will appear here.
            </p>
          )}
        </div>
      </section>
      {inbox.history.length > 0 && (
        <section aria-labelledby="ap-history">
          <h2 id="ap-history" className="ap-section-label">History</h2>
          <div className="ap-history">
            {inbox.history.map((d) => (
              <button
                className="ap-row ap-history-row"
                key={d.decisionId}
                aria-haspopup="dialog"
                onClick={() => send({ type: "OPEN", decisionId: d.decisionId })}
              >
                <RowMark d={d} />
                <span className="ap-row-text">
                  <strong>{d.title}</strong>
                  <small>{historyLine(d)}</small>
                </span>
                <Chevron />
              </button>
            ))}
          </div>
        </section>
      )}
      <footer className="ap-session-footer">
        <button
          className="ap-text-button ap-destructive"
          onClick={() => send({ type: "END" })}
        >
          End session
        </button>
        {inbox.session.paired && <p>Session expires {when(inbox.session.expiresAt!)}</p>}
      </footer>
    </>
  );
}
const CheckIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3.5 9.5l3.5 3.5 7.5-8" />
  </svg>
);
const DoubleCheck = () => (
  <svg width="20" height="14" viewBox="0 0 20 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1.5 7.5l3.5 3.5 7-8" />
    <path d="M9 10.5l.5.5 7-8" />
  </svg>
);
// Counts down the Undo window from when it opened; the machine owns the real deadline.
function UndoButton({ onUndo }: { onUndo: () => void }) {
  const seconds = Math.ceil(UNDO_MS / 1000),
    [left, setLeft] = useState(seconds);
  useEffect(() => {
    const start = Date.now(),
      timer = setInterval(() => setLeft(Math.max(1, Math.ceil((UNDO_MS - (Date.now() - start)) / 1000))), 250);
    return () => clearInterval(timer);
  }, []);
  return (
    <button className="ap-undo" data-autofocus onClick={onUndo}>
      Undo · {left}s
    </button>
  );
}
function DecisionTray({
  snapshot,
  send,
}: {
  snapshot: CardSnapshot;
  send: (event: CardEvent) => void;
}) {
  const c = snapshot.context,
    d = currentCard(c);
  if (!d) return null;
  const at = (screen: "undoing" | "sending" | "sendFailed" | "sent") => snapshot.matches({ live: { screen } }),
    undoing = at("undoing"),
    busy = at("sending"),
    sendFailed = at("sendFailed"),
    history = d.status !== "open",
    // Once the agent finishes, an open card can be read but no longer answered.
    finished = !!c.inbox?.session.finishedAt,
    // From Send on, the sheet shows the answer instead of the choices to make; a card reopened from history shows them disabled.
    live = undoing || busy || sendFailed || at("sent"),
    outcome = live || history || finished,
    // Once the agent confirms, nothing is left to do on this card but close it.
    confirmed = !!d.acknowledgement && (at("sent") || (history && !live)),
    pairing = d.kind === "pairing",
    feedback = c.choice?.kind === "feedback",
    draft = c.choice?.kind === "feedback" ? c.choice.text : "",
    valid = Schema.is(Choice)(c.choice) && acceptsChoice(d.card, c.choice!),
    answer = d.answer?.choice ?? c.pending?.choice ?? null,
    chosen = outcome ? answer : c.choice,
    pick = pairing ? null : d.card.options.find((o) => o.number === d.card.recommended);
  return (
    <Tray decisionId={d.decisionId} focusKey={outcome ? (undoing ? "undoing" : "outcome") : "answer"} title={d.title} busy={busy} onClose={() => send({ type: "BACK" })}>
      <div className="ap-answer-scroll" tabIndex={0}>
        <header className="ap-sheet-head">
          <h2>{d.title}</h2>
          <button
            className="ap-round ap-close"
            aria-label={undoing ? "Cancel and close" : "Close decision"}
            disabled={busy}
            onClick={() => send({ type: "BACK" })}
          >
            <Close />
          </button>
        </header>
        {pairing ? (
          <p className="ap-pick">
            Recommended: <strong>{PAIRING_RECOMMENDATION}</strong>
          </p>
        ) : pick && (
          <p className="ap-pick">
            Recommended: <span aria-hidden="true">{pick.emoji}</span> <strong>{pick.title}</strong>
          </p>
        )}
        {d.detail && <Detail text={d.detail} />}
        {outcome && answer && (
          <section className="ap-outcome" aria-label="Your answer">
            <span className={answer.kind === "feedback" ? "ap-outcome-mark ap-outcome-feedback" : "ap-outcome-mark"}>
              {answer.kind === "feedback" ? <FeedbackIcon /> : <CheckIcon size={28} />}
            </span>
            <strong>{answer.kind === "feedback" ? "Changes requested" : choiceText(d, answer)}</strong>
            {/* The live status row; once the agent confirms, its reply box shows that, so the row only announces it. */}
            <div className={d.acknowledgement && !undoing && !busy ? "ap-outcome-status ap-quiet" : "ap-outcome-status"} role="status">
              {undoing ? (
                <UndoButton onUndo={() => send({ type: "UNDO" })} />
              ) : busy ? (
                <span className="ap-meta"><Spinner />Sending…</span>
              ) : sendFailed ? null : d.acknowledgement ? (
                <span className="ap-visually-hidden">Your agent confirmed</span>
              ) : (
                <span className="ap-meta"><Spinner />Waiting for your agent</span>
              )}
            </div>
          </section>
        )}
        {finished && !history && !live && (
          <p role="status">
            {c.error === "AgentFinished"
              ? "Your agent finished before this answer was sent. Nothing was sent."
              : "Your agent finished before you answered. This card can no longer be answered."}
          </p>
        )}
        {at("sent") && c.error === "AlreadyAnswered" && (
          <p role="alert">This decision already has an answer. Your draft did not replace it.</p>
        )}
        {outcome && d.acknowledgement && (
          <div className="ap-ack">
            <span className="ap-confirmed"><DoubleCheck />Your agent confirmed</span>
            <time className="ap-meta" dateTime={d.acknowledgement.acknowledgedAt}>
              {when(d.acknowledgement.acknowledgedAt)}
            </time>
            <blockquote>{d.acknowledgement.nextSteps}</blockquote>
          </div>
        )}
        {outcome && answer?.kind === "feedback" && (
          <div className="ap-history-detail">
            <h3>Your feedback</h3>
            <blockquote>{answer.text}</blockquote>
          </div>
        )}
        {!live && (
          <div className="ap-options" role="group" aria-label="Choices">
            {d.card.options.map((o) => {
              const selected = chosen?.kind === "option" && chosen.number === o.number,
                detailId = `${d.decisionId}-${o.number}-detail`,
                showDetail = selected && !!o.detail;
              return (
                <button
                  key={`${d.decisionId}:${o.number}`}
                  className="ap-option"
                  disabled={outcome}
                  aria-label={`Choose ${o.number}: ${o.title}`}
                  aria-pressed={selected}
                  aria-describedby={showDetail ? detailId : undefined}
                  onClick={() => send({ type: "SELECT", number: o.number })}
                >
                  <span className="ap-option-emoji" aria-hidden="true">{o.emoji}</span>
                  <span className="ap-option-copy">
                    <strong>{o.title}</strong>
                    {/* Choosing an option is how its detail opens; there is no second control. */}
                    {showDetail && <span className="ap-option-detail" id={detailId}>{o.detail}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        )}
        {feedback && !outcome && (
          <div className="ap-feedback">
            <label htmlFor="feedback">What should your agent change?</label>
            <textarea
              id="feedback"
              autoFocus
              value={draft}
              onChange={(e) => send({ type: "EDIT", text: e.target.value })}
            />
            <small>
              Sending closes this question; your agent can ask again.
              {characters(draft) > BODY_MAX_CHARACTERS * 0.9 && ` ${characters(draft)} / ${BODY_MAX_CHARACTERS}`}
            </small>
            {draft && !valid && (
              <p role="status">
                Write valid text within the limit, without HTML. Your draft
                stays here.
              </p>
            )}
          </div>
        )}
      </div>
      {confirmed && (
        <div className="ap-card-actions">
          <button className="ap-primary" onClick={() => send({ type: "BACK" })}>
            Close
          </button>
        </div>
      )}
      {(sendFailed || !outcome) && (
        <div className="ap-card-actions">
          {pairing && c.error === "InvalidInput" && (
            <p role="alert">
              That is not the emoji your agent showed. Nothing was sent. Choose
              again, then Send.
            </p>
          )}
          {sendFailed ? (
            <>
              <p role="alert">
                {history
                  ? "Your stored answer is visible. Its original receipt was not confirmed."
                  : "Your answer is not confirmed. Retry sends the same prepared answer."}
              </p>
              <button
                className="ap-primary"
                onClick={() => send({ type: "RETRY" })}
              >
                Retry
              </button>
            </>
          ) : (
            <>
              <button
                className="ap-primary"
                disabled={!valid}
                onClick={() => send({ type: "SEND" })}
              >
                Send
              </button>
              {!pairing && !feedback && (
                <button
                  className="ap-text-button"
                  onClick={() => send({ type: "FEEDBACK" })}
                >
                  <FeedbackIcon />
                  Ask for changes
                </button>
              )}
            </>
          )}
        </div>
      )}
    </Tray>
  );
}

export function CardScreen({
  snapshot,
  send,
}: {
  snapshot: CardSnapshot;
  send: (event: CardEvent) => void;
}) {
  const c = snapshot.context,
    live = snapshot.matches("live"),
    at = (screen: "view" | "undoing" | "sending" | "sent" | "sendFailed" | "confirmEnd" | "ending") =>
      snapshot.matches({ live: { screen } }),
    decision = at("view") || at("undoing") || at("sending") || at("sent") || at("sendFailed"),
    modal = decision || at("confirmEnd") || at("ending");
  return (
    <div className="ap-app ap-rich" data-theme="system">
      <div className="ap-base" inert={modal}>
        <nav className="ap-nav" aria-label="Primary">
          <div className="ap-nav-left">
            <a className="ap-back" href={ROUTES.homeApp.path} aria-label="All sessions">
              <BackChevron />
            </a>
          </div>
          <div className="ap-nav-center">
            {c.inbox && <h1>{c.inbox.session.name}</h1>}
          </div>
          <div className="ap-nav-right">
            {!(live && c.inbox && !c.inbox.session.paired) && <button
              className={"ap-session-status " + (!live || c.inbox?.session.finishedAt ? "ap-inactive" : "")}
              disabled={!snapshot.can({ type: "END" })}
              onClick={() => send({ type: "END" })}
            >
              <span />
              {live
                ? c.inbox?.session.finishedAt ? "Finished" : "Active"
                : snapshot.matches("ended")
                  ? "Ended"
                  : snapshot.matches("expired")
                    ? "Expired"
                    : "Connecting"}
            </button>}
          </div>
        </nav>
        <main className="ap-scroll">
          <div className="ap-column ap-session-column">
            {live && c.inbox && <Queue context={c} send={send} />}
            {snapshot.matches("loading") && (
              <p className="ap-loading" role="status">
                <Spinner />
                Loading your decisions…
              </p>
            )}
            {snapshot.matches("failed") && (
              <section className="ap-panel">
                <h2>Could not load your decisions</h2>
                <p>Your session may be offline.</p>
                <button
                  className="ap-primary"
                  onClick={() => send({ type: "RETRY" })}
                >
                  Retry
                </button>
              </section>
            )}
            {snapshot.matches("expired") && (
              <section className="ap-panel">
                <h2>Session expired</h2>
                <p>
                  Your decisions have been cleared. Ask your agent to start a
                  new session.
                </p>
              </section>
            )}
            {snapshot.matches("ended") && (
              <section className="ap-panel">
                <h2>Session ended</h2>
                {c.endedBy && (
                  <p>
                    {c.endedBy === "owner"
                      ? "You ended this session."
                      : "Your agent ended this session before you paired."}
                  </p>
                )}
                <p>The session’s decisions have been cleared.</p>
              </section>
            )}
          </div>
        </main>
      </div>
      {decision && <DecisionTray snapshot={snapshot} send={send} />}
      {(at("confirmEnd") || at("ending")) && (
        <Tray title="End this session?" busy={at("ending")} onClose={() => send({ type: "BACK" })}>
          <div className="ap-receipt">
            <h2>End this session?</h2>
            <p>
              This clears its decisions and history. You cannot restore
              them.
            </p>
            {c.error && at("confirmEnd") && (
              <p role="alert">Ending was not confirmed. The session may still be active.</p>
            )}
            <button
              className="ap-primary ap-danger"
              disabled={at("ending")}
              onClick={() => send({ type: "CONFIRM_END" })}
            >
              {at("ending") ? "Ending…" : "End session"}
            </button>
            <button
              className="ap-secondary"
              disabled={at("ending")}
              onClick={() => send({ type: "BACK" })}
            >
              Keep session
            </button>
          </div>
        </Tray>
      )}
    </div>
  );
}
export function CardApp({
  layer,
  now = Date.now,
  undoMs = UNDO_MS,
  sendRetries = SEND_RETRIES,
}: {
  layer: Layer.Layer<CardApi>;
  now?: () => number;
  undoMs?: number;
  sendRetries?: number;
}) {
  const machine = useMemo(() => createCardMachine(layer, now, undoMs, sendRetries), [layer, now, undoMs, sendRetries]);
  const [snapshot, send] = useMachine(machine);
  return <CardScreen snapshot={snapshot} send={send} />;
}
