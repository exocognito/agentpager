import { useId } from "react";
import { SendStatus, answerText } from "./AgentScreen.tsx";
import type { Answered, Decision } from "./fixtures.ts";
import { ArrowUpIcon, BackButton, BubbleIcon, CheckIcon, Chevron, CloseButton, GlassButton, NavBar, Phone, Section, Sheet, TrayIcon, Unavailable } from "./kit.tsx";
import { WORDS, agentConfirmedAt, time, youAt } from "./words.ts";

// A decision opens as a sheet: its question and detail, the options as one list with every option's detail
// and the agent's recommendation tagged, then Ask for Changes. Send closes the sheet and opens Undo.
export function DecisionSheet({ agent, decision, selection, dark }: { agent: string; decision?: Decision; selection?: number; dark?: boolean }) {
  return (
    <Phone dark={dark} presenting label={decision?.title ?? WORDS.decisionCleared}>
      <Sheet label={decision?.title ?? WORDS.decisionCleared}>
        <NavBar small={agent} trailing={<CloseButton />} />
        {decision ? (
          <>
            <Header decision={decision} />
            <div className="list">
              <Section header={WORDS.chooseOne} sep="emoji">
                {decision.options.map((o) => (
                  <button key={o.number} type="button" className="cell" aria-pressed={o.number === selection}>
                    <span className="emoji" aria-hidden="true">{o.emoji}</span>
                    <span className="cell-text">
                      <span className="cell-title">{o.title}</span>
                      {o.detail && <span className="cell-sub">{o.detail}</span>}
                      {decision.recommended === o.number && <span className="tag">{WORDS.recommended}</span>}
                    </span>
                    {o.number === selection && <CheckIcon />}
                  </button>
                ))}
              </Section>
              <Section sep="icon" gap>
                <button type="button" className="cell action">
                  <BubbleIcon />
                  <span className="cell-text"><span className="cell-title">{WORDS.askForChanges}</span></span>
                  <Chevron />
                </button>
              </Section>
            </div>
            <div className="bottom-bar">
              <button type="button" className="btn-prominent" disabled={selection === undefined}>{WORDS.send}</button>
            </div>
          </>
        ) : (
          <Unavailable icon={<TrayIcon />} title={WORDS.decisionCleared}>
            <p>{WORDS.decisionClearedText}</p>
          </Unavailable>
        )}
      </Sheet>
    </Phone>
  );
}

function Header({ decision }: { decision: Decision }) {
  return (
    <>
      <h2 className="sheet-title">{decision.title}</h2>
      {decision.detail && <p className="sheet-body">{decision.detail}</p>}
    </>
  );
}

// Ask for Changes: a note sent instead of an option. Send stays off until the note has text, fits 1000
// characters and holds no HTML tag.
export function AskChangesSheet({ decision, text, dark }: { decision: Decision; text: string; dark?: boolean }) {
  const id = useId();
  const html = /<[A-Za-z/!?]/.test(text);
  const valid = text.trim().length > 0 && text.length <= 1000 && !html;
  return (
    <Phone dark={dark} presenting label={WORDS.askForChanges}>
      <Sheet label={WORDS.askForChanges}>
        <NavBar leading={<BackButton label="Back" />} title={WORDS.askForChanges} subtitle={decision.title} trailing={<GlassButton label={WORDS.send} tinted disabled={!valid}><ArrowUpIcon /></GlassButton>} />
        <div className="list">
          <label className="section-header" htmlFor={id}>{WORDS.changesHeader}</label>
          <div className="group">
            <textarea id={id} className="compose" defaultValue={text} />
          </div>
          <p className="section-footer">{html ? WORDS.changesHtml : WORDS.changesFooter}</p>
        </div>
      </Sheet>
    </Phone>
  );
}

// An answered decision reopens as a thread: your answer and your agent's reply as bubbles, the options below.
export function ThreadSheet({ agent, answered, timeZone, dark }: { agent: string; answered: Answered; timeZone?: string; dark?: boolean }) {
  const { decision, choice, state } = answered;
  const chosen = choice.kind === "option" ? choice.number : undefined;
  const mine = chosen === undefined ? answerText(answered) : `${decision.options.find((o) => o.number === chosen)?.emoji ?? ""} ${answerText(answered)}`;
  return (
    <Phone dark={dark} presenting label={decision.title}>
      <Sheet label={decision.title}>
        <NavBar small={agent} trailing={<CloseButton />} />
        <Header decision={decision} />
        <div className="thread">
          <p className="bubble mine">{mine}</p>
          <p className="bubble-caption mine">{youAt(time(answered.sentAt, timeZone))}</p>
          {state.kind === "confirmed" ? (
            <>
              <p className="bubble theirs">{state.nextSteps}</p>
              <p className="bubble-caption theirs"><CheckIcon size={13} className="confirmed" />{agentConfirmedAt(time(state.at, timeZone))}</p>
            </>
          ) : (
            <SendStatus state={state} />
          )}
        </div>
        <div className="list">
          <Section header={WORDS.options} sep="emoji">
            {decision.options.map((o) => (
              // The options not chosen can no longer be chosen, so they are drawn as disabled rows.
              <button key={o.number} type="button" className={o.number === chosen ? "cell" : "cell dim"} disabled={o.number !== chosen} aria-pressed={o.number === chosen}>
                <span className="emoji" aria-hidden="true">{o.emoji}</span>
                <span className="cell-text">
                  <span className={o.number === chosen ? "cell-title strong" : "cell-title"}>{o.title}</span>
                  {o.detail && <span className="cell-sub">{o.detail}</span>}
                </span>
                {o.number === chosen && <CheckIcon />}
              </button>
            ))}
          </Section>
        </div>
      </Sheet>
    </Phone>
  );
}

