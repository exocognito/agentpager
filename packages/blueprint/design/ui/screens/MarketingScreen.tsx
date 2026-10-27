import { useRef, useState } from "react";
import { createActor } from "xstate";
import { Layer, Schema } from "effect";
import "./marketing.css";
import { CARD_AGENT_INSTRUCTION, PRODUCTION_ORIGIN } from "./StartScreen.tsx";
import { CardScreen } from "./CardScreen.tsx";
import { CardApi } from "../../effects/cards.ts";
import { ROUTES } from "../../effects/session.ts";
import { createCardMachine } from "../../machines/cards.ts";
import { Inbox } from "../../schemas/exchange.ts";
import { LogoMark } from "../components/LogoMark.tsx";
import { QrPicture } from "../components/QrPicture.tsx";
import { CopyIcon } from "../components/CopyIcon.tsx";
import { installPlaywrightQuestion, session } from "../fixtures/decisions.ts";

const host = new URL(PRODUCTION_ORIGIN).host,
  pro = "$2.99/mo";

// The App Store page, once AgentPager for iPhone is published. Empty until then: the download
// buttons show, but do not link anywhere.
export const APP_STORE_URL: string = "";

export const MARKETING = {
  headline: "Let your agents bring their decisions to you",
  intro:
    "Leave your agents working while you are away. When one needs you, it pages your iPhone with a decision you can answer in two taps, and it carries on.",
  terminal: {
    scan: "Scan with your iPhone to connect",
    connected: "connected · Sam’s iPhone",
    thoughts: [
      "Screenshots need Playwright, but it isn’t installed here.",
      "Installing software needs Sam’s OK. I’ll ask him over AgentPager.",
    ],
    asked: `Asked Sam: ${installPlaywrightQuestion.title}`,
    waiting: "waiting for Sam",
  },
  how: [
    [
      "Connect your agent once",
      "Scan the code it shows with your iPhone. Or give the agents you trust your pager number in AGENTS.md, and they page you with no setup at all.",
    ],
    [
      "Your agent asks when it needs you",
      "Instead of guessing or getting stuck, it sends you the decision. Your iPhone alerts you, even with the app closed.",
    ],
    [
      "Decide in seconds, from anywhere",
      "Choose an option and press Send. Once your few seconds to undo have passed, your agent has your answer at once and tells you its next steps.",
    ],
  ],
  scenes: [
    "An agent terminal shows a QR code. Once your iPhone scans it, the terminal says it is connected to Sam’s iPhone.",
    `The agent finds it needs Sam’s OK to install software, asks him over AgentPager, and waits: ${installPlaywrightQuestion.title}`,
    `Sam’s iPhone shows the agent’s card: ${installPlaywrightQuestion.title}, with Yes, install it chosen.`,
  ],
  getStarted: "Get started for free",
  steps: {
    app: ["Get AgentPager for iPhone", "Free on the App Store. Everything else happens in the app."],
    tell: ["Tell your agent", "Paste this into any agent session:"],
    scan: [
      "Pair",
      "Open your agent’s link on your iPhone, or scan its QR code with the Camera, and tap Open in AgentPager. Tap the three emojis your agent showed you, in order, then press Pair.",
    ],
  },
  download: "Download",
  comingSoon: "Coming to the App Store",
  instruction: CARD_AGENT_INSTRUCTION,
  copy: "Copy",
  copiedShort: "Copied",
  copied: "Copied. Paste it to your agent.",
  made: "Made for humans and agents",
  madeIntro:
    "AgentPager is a pager you can give any agent, running anywhere, so it can reach you for the decisions that matter instead of guessing or stopping.",
  features: [
    [
      "Works wherever agents run",
      "Any harness, any machine: laptop, dev box, cloud VM, container. Agents need only HTTPS or MCP, with nothing to install on their side.",
    ],
    [
      "Alerts that find you",
      "Your iPhone alerts you with the agent’s name and its question, even with the app closed. Tap the alert and you are on the decision.",
    ],
    [
      "Choose, then Send",
      "Not an agent chat. Each message is designed to be a quick decision. Approve, decline, or ask for changes.",
    ],
    [
      "One number for all your agents",
      "Put your pager number in AGENTS.md and every agent you trust pages you, already paired. Change the number any time; pagers already open keep working.",
    ],
    [
      "Pagers that fit the work",
      "A pager lasts 24 hours, 7 days or 30 days, your choice. Ended pagers stay readable on your phone for a day, then their decisions are gone.",
    ],
    [
      "Nothing to sign up for",
      "No account. Links work once, keys are stored only as digests, and a lost phone means a new pager, never a transfer.",
    ],
  ],
  questions: "Questions",
  faq: [
    [
      "Which agents does it work with?",
      `Any agent client that can send HTTPS requests or add an MCP server. It starts at ${PRODUCTION_ORIGIN}${ROUTES.start.path}`,
    ],
    [
      "I already get notifications from my agent app. Why do I need this?",
      "Maybe you don’t! AgentPager is useful when running agents in different apps or machines. If you find yourself “checking in” on long-running agent sessions anywhere, give them AgentPager to contact you instead.",
    ],
    [
      "Is there an Android or web version?",
      "Not yet. AgentPager is an iPhone app. Your agents can run anywhere.",
    ],
    [
      "What does it cost?",
      `AgentPager is free while it is in testing. A Pro plan from ${pro} is planned; it is not on sale yet. Email pro@agentpager.me with the features you want to see in Pro.`,
    ],
  ],
  cta: "Get AgentPager for iPhone",
  ctaIntro: "Download the app and paste one line to your agent. The next time it needs you, it pages you.",
  ctaButton: "Download for iPhone",
  ctaNote: "Free while in testing · Pro planned",
  copyright: "© 2026 AgentPager",
} as const;

// The phone shows the real card screen with the Playwright card open and its first option chosen. It is a picture: nothing in it can take focus.
const phone = (() => {
  const layer = Layer.succeed(CardApi, {} as never),
    machine = createCardMachine(layer, () => Date.parse(installPlaywrightQuestion.askedAt)),
    inbox = Schema.decodeUnknownSync(Inbox)({ session, open: [installPlaywrightQuestion], history: [] });
  return machine.resolveState({
    value: { live: { screen: "view", clock: "counting" } },
    context: { ...createActor(machine).getSnapshot().context, inbox, viewing: installPlaywrightQuestion.decisionId, choice: { kind: "option", number: 1 } },
  });
})();

const Brand = () => (
  <a className="mk-brand" href={ROUTES.frontPage.path}>
    <LogoMark size={22} />
    AgentPager
  </a>
);

// The download button: a link to the App Store once there is one, a placeholder until then.
const Download = ({ className, label }: { className: string; label: string }) =>
  APP_STORE_URL ? (
    <a className={className} href={APP_STORE_URL}>
      {label}
    </a>
  ) : (
    <span className={`${className} mk-soon`} aria-disabled="true" title={MARKETING.comingSoon}>
      {label}
    </span>
  );

const Caption = ({ n }: { n: number }) => (
  <div className="mk-caption">
    <span className="mk-step">{n + 1}</span>
    <h2>{MARKETING.how[n][0]}</h2>
    <p>{MARKETING.how[n][1]}</p>
  </div>
);

// The page at `/`. The product serves this screen; a check reads these strings back.
export function MarketingScreen({
  copyText = (text) => navigator.clipboard.writeText(text),
}: {
  copyText?: (text: string) => Promise<void>;
}) {
  const [status, setStatus] = useState("");
  const line = useRef<HTMLElement>(null);
  const copy = () => {
    setStatus("");
    if (line.current) window.getSelection()?.selectAllChildren(line.current);
    return copyText(MARKETING.instruction).then(
      () => setStatus(MARKETING.copied),
      () => {},
    );
  };
  const t = MARKETING.terminal;
  return (
    <div className="mk">
      <header className="mk-nav">
        <Brand />
      </header>
      <main>
        <section className="mk-hero">
          <h1>{MARKETING.headline}</h1>
          <p className="mk-lead">{MARKETING.intro}</p>
          <ol className="mk-how">
            <li>
              <div className="mk-panel mk-dark mk-panel-scan" role="img" aria-label={MARKETING.scenes[0]}>
                <p>
                  <span className="mk-green">●</span> {t.scan}
                </p>
                <QrPicture className="mk-qr" />
                <p className="mk-green">✓ {t.connected}</p>
              </div>
              <Caption n={0} />
            </li>
            <li>
              <div className="mk-panel mk-dark mk-panel-ask" role="img" aria-label={MARKETING.scenes[1]}>
                {t.thoughts.map((line) => (
                  <p key={line}>
                    <span className="mk-dim">∴</span>
                    {line}
                  </p>
                ))}
                <p className="mk-asked">
                  <span>◆</span>
                  {t.asked}
                </p>
                <p className="mk-waiting">
                  {t.waiting}
                  <i className="mk-cursor" />
                </p>
              </div>
              <Caption n={1} />
            </li>
            <li>
              <div className="mk-panel mk-panel-phone" role="img" aria-label={MARKETING.scenes[2]}>
                <div className="mk-phone" aria-hidden="true">
                  <div className="mk-phone-screen" inert>
                    <i className="mk-island" />
                    <div className="mk-phone-app">
                      <CardScreen snapshot={phone} send={() => {}} />
                    </div>
                  </div>
                </div>
              </div>
              <Caption n={2} />
            </li>
          </ol>
        </section>

        <section className="mk-section" aria-labelledby="get-started">
          <h2 id="get-started">{MARKETING.getStarted}</h2>
          <ol className="mk-steps">
            <li>
              <span className="mk-n">1</span>
              <div>
                <h3>{MARKETING.steps.app[0]}</h3>
                <p>{APP_STORE_URL ? MARKETING.steps.app[1] : MARKETING.comingSoon}</p>
              </div>
              <Download className="mk-action" label={MARKETING.download} />
            </li>
            <li>
              <span className="mk-n">2</span>
              <div>
                <h3>{MARKETING.steps.tell[0]}</h3>
                <p>{MARKETING.steps.tell[1]}</p>
              </div>
              <div className="mk-copy">
                <code ref={line}>{MARKETING.instruction}</code>
                <button aria-label="Copy the agent instruction" onClick={copy}>
                  <CopyIcon />
                  {status === MARKETING.copied ? MARKETING.copiedShort : MARKETING.copy}
                </button>
                <span
                  className="mk-hidden"
                  role="status"
                  aria-live="polite"
                >
                  {status}
                </span>
              </div>
            </li>
            <li>
              <span className="mk-n">3</span>
              <div>
                <h3>{MARKETING.steps.scan[0]}</h3>
                <p>{MARKETING.steps.scan[1]}</p>
              </div>
            </li>
          </ol>
        </section>

        <section className="mk-section" aria-labelledby="made">
          <h2 id="made">{MARKETING.made}</h2>
          <p className="mk-lead">{MARKETING.madeIntro}</p>
          <ul className="mk-features">
            {MARKETING.features.map(([title, text]) => (
              <li key={title}>
                <h3>{title}</h3>
                <p>{text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mk-section mk-faq" aria-labelledby="questions">
          <h2 id="questions">{MARKETING.questions}</h2>
          <dl>
            {MARKETING.faq.map(([q, a]) => (
              <div key={q}>
                <dt>{q}</dt>
                <dd>{a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="mk-cta" aria-labelledby="cta">
          <h2 id="cta">{MARKETING.cta}</h2>
          <p>{MARKETING.ctaIntro}</p>
          <Download className="mk-button" label={MARKETING.ctaButton} />
          <small>{APP_STORE_URL ? MARKETING.ctaNote : `${MARKETING.comingSoon} · ${MARKETING.ctaNote}`}</small>
        </section>
      </main>
      <footer className="mk-footer">
        <span className="mk-footer-brand">
          <LogoMark size={16} />
          {host}
        </span>
        <span>{MARKETING.copyright}</span>
      </footer>
    </div>
  );
}
