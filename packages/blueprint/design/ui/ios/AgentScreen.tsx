import type { Answered, Decision, Pager, SendState } from "./fixtures.ts";
import { ActionSheet, Alert, BackButton, CheckIcon, Chevron, ClockIcon, GlassButton, MoreIcon, NavBar, NoteIcon, Phone, Section, Spinner, XCircleIcon } from "./kit.tsx";
import { END_REASON, KEEP_ENDED_MS, LIFETIME, LIFETIMES, WORDS, endConfirmTitle, exactEnd, remaining, removedIn, sendingIn, subtitle } from "./words.ts";

export type AgentOverlay = "menu" | "endsMenu" | "endConfirm" | "notConfirmed";
type Props = { pager: Pager; open?: Decision[]; answered?: Answered[]; now: Date; timeZone?: string; overlay?: AgentOverlay; undoSeconds?: number; dark?: boolean };

// One agent's pager: its open decisions, then the ones answered, each showing where its answer is until the
// agent confirms it. The ⋯ menu changes when the pager ends, or ends it. An ended pager says why, and shows the
// phone's read-only copy of its decisions until it is removed, 24 hours after the end.
export function AgentScreen({ pager, open = [], answered = [], now, timeZone, overlay, undoSeconds, dark }: Props) {
  const ended = pager.status === "ended";
  return (
    <Phone dark={dark} label={pager.name}>
      <div className="safe-top" />
      <NavBar leading={<BackButton />} title={pager.name} subtitle={subtitle(pager, now)} trailing={ended ? undefined : <GlassButton label={WORDS.more}><MoreIcon /></GlassButton>} />
      {ended ? (
        <div className="list">
          <Section footer={removedIn(remaining(new Date((pager.endedAt ?? now).getTime() + KEEP_ENDED_MS), now))}>
            <div className="cell">
              <span className="cell-text">
                <span className="cell-title strong">{WORDS.ended}</span>
                <span className="cell-sub">{END_REASON[pager.endReason ?? "timedOut"]}</span>
              </span>
            </div>
          </Section>
          {open.length === 0 && answered.length === 0 && (
            <Section>
              <p className="cell note-row">{WORDS.noDecisionsOnPhone}</p>
            </Section>
          )}
          {open.length > 0 && <Section header={WORDS.notAnswered} sep="dot">{open.map((d) => <OpenRow key={d.decisionId} decision={d} answerable={false} />)}</Section>}
          {answered.length > 0 && <Section header={WORDS.answered} sep="emoji">{answered.map((a) => <AnsweredRow key={a.decision.decisionId} answered={a} />)}</Section>}
        </div>
      ) : (
        <div className={overlay === "menu" || overlay === "endsMenu" ? "list blurred" : "list"}>
          {open.length === 0 && answered.length === 0 && (
            <Section>
              <p className="cell note-row">{WORDS.noDecisions}</p>
            </Section>
          )}
          {open.length > 0 && (
            <Section header={WORDS.open} sep="dot">
              {open.map((d) => <OpenRow key={d.decisionId} decision={d} answerable />)}
            </Section>
          )}
          {answered.length > 0 && (
            <Section header={WORDS.answered} sep="emoji">
              {answered.map((a) => <AnsweredRow key={a.decision.decisionId} answered={a} />)}
            </Section>
          )}
        </div>
      )}
      {(overlay === "menu" || overlay === "endsMenu") && pager.endsAt && (
        <>
          <button type="button" className="menu-close" aria-label={WORDS.close} />
          <div className="menu">
            <p className="menu-title">{exactEnd(pager.endsAt, timeZone)}</p>
            <div role="menu" aria-label={exactEnd(pager.endsAt, timeZone)}>
            <button type="button" className="menu-item" role="menuitem" aria-haspopup="menu" aria-expanded={overlay === "endsMenu"}>
              <span>{WORDS.ends}</span>
              <span className="menu-value">in {remaining(pager.endsAt, now)}<Chevron /></span>
            </button>
            {overlay === "endsMenu" && (
              <div className="menu-sub" role="group" aria-label={WORDS.ends}>
                {LIFETIMES.map((l) => (
                  <button key={l} type="button" className="menu-item radio" role="menuitemradio" aria-checked={l === pager.lifetime}>
                    <span className="menu-check">{l === pager.lifetime && <CheckIcon size={16} className="" />}</span>
                    {LIFETIME[l].label}
                  </button>
                ))}
              </div>
            )}
            <button type="button" className="menu-item destructive" role="menuitem">{WORDS.endPager}<XCircleIcon /></button>
            </div>
          </div>
        </>
      )}
      {overlay === "endConfirm" && <ActionSheet title={endConfirmTitle(pager.name)} text={WORDS.endConfirmText} action={WORDS.endPager} cancel={WORDS.cancel} />}
      {undoSeconds !== undefined && (
        <div className="toolbar center">
          <div className="glass-pill" role="status">
            <span>{sendingIn(undoSeconds)}</span>
            <button type="button" className="pill-btn">{WORDS.undo}</button>
          </div>
        </div>
      )}
      {overlay === "notConfirmed" && <Alert title={WORDS.notConfirmed} text={WORDS.notConfirmedText} cancel={WORDS.cancel} action={WORDS.retry} />}
    </Phone>
  );
}

// An open decision. On an ended pager it is the phone's read-only copy: gray, and it opens nothing.
function OpenRow({ decision, answerable }: { decision: Decision; answerable: boolean }) {
  const content = (
    <>
      <span className={answerable ? "dot blue" : "dot gray"} />
      <span className="cell-text">
        <span className="cell-title strong">{decision.title}</span>
        {decision.detail && <span className="cell-sub">{decision.detail}</span>}
      </span>
    </>
  );
  if (!answerable) return <div className="cell top">{content}</div>;
  return <button type="button" className="cell top">{content}<Chevron /></button>;
}

export function answerText(a: Answered): string {
  if (a.choice.kind === "feedback") return a.choice.text;
  const n = a.choice.number;
  return a.decision.options.find((o) => o.number === n)?.title ?? `Option ${n}`;
}

function AnswerEmoji({ answered }: { answered: Answered }) {
  const choice = answered.choice;
  if (choice.kind === "feedback") return <span className="emoji symbol"><NoteIcon /></span>;
  return <span className="emoji" aria-hidden="true">{answered.decision.options.find((o) => o.number === choice.number)?.emoji}</span>;
}

// Before the agent confirms: a countdown while Undo is open, then sending, then waiting for the agent.
export function SendStatus({ state }: { state: SendState }) {
  if (state.kind === "confirmed") return null;
  return (
    <span className="cell-status">
      {state.kind === "undo" ? <ClockIcon /> : <Spinner />}
      {state.kind === "undo" ? sendingIn(state.seconds) : state.kind === "sending" ? WORDS.sending : WORDS.waitingForAgent}
    </span>
  );
}

function AnsweredRow({ answered }: { answered: Answered }) {
  const confirmed = answered.state.kind === "confirmed";
  return (
    <button type="button" className="cell top">
      <AnswerEmoji answered={answered} />
      <span className="cell-text">
        <span className="cell-title">{answered.decision.title}</span>
        <span className="cell-sub with-icon">
          {confirmed && <CheckIcon size={15} className="confirmed" label={WORDS.agentConfirmed} />}
          <span className="one-line">{answerText(answered)}</span>
        </span>
        <SendStatus state={answered.state} />
      </span>
      <Chevron />
    </button>
  );
}
