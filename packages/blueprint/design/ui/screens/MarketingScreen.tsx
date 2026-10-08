import { useRef, useState } from "react";
import { createActor } from "xstate";
import { Layer, Schema } from "effect";
import "./marketing.css";
import { CARD_AGENT_INSTRUCTION, PRODUCTION_ORIGIN } from "./StartScreen.tsx";
import { CardScreen } from "./CardScreen.tsx";
import { CardApi } from "../../effects/cards.ts";
import { ROUTES } from "../../effects/session.ts";
import { createCardMachine } from "../../machines/cards.ts";
import { Inbox, SESSION_LIFETIME_MS } from "../../schemas/exchange.ts";
import { LogoMark } from "../components/LogoMark.tsx";
import { QrPicture } from "../components/QrPicture.tsx";
import { CopyIcon } from "../components/CopyIcon.tsx";
import { installPlaywrightQuestion, session } from "../fixtures/decisions.ts";

const host = new URL(PRODUCTION_ORIGIN).host,
  pro = "$2.99/mo";

export const MARKETING = {
  headline: "Let your agents bring their decisions to you",
  intro:
    "Never again find your agent stuck, waiting for your answer. Now your agent can page you when it needs your decision.",
  terminal: {
    scan: "Scan with your phone to connect",
    connected: "connected · Sam’s iPhone",
    thoughts: [
      "Screenshots need Playwright, but it isn’t installed here.",
      "Installing software needs Sam’s OK. I’ll ask him over AgentPager.",
    ],
    asked: `Asked Sam: ${installPlaywrightQuestion.title}`,
    waiting: "waiting for Sam",
  },
  how: [
    ["Scan the code your agent shows", "This connects the agent with your phone without sharing personal contact info"],
    ["Your agent asks when it needs you", "Instead of guessing or getting stuck, your agent sends you the decision"],
    ["Decide in seconds, from anywhere", "Your agent gets your response and keeps working"],
  ],
  scenes: [
    "An agent terminal shows a QR code. Once your phone scans it, the terminal says it is connected to Sam’s iPhone.",
    `The agent finds it needs Sam’s OK to install software, asks him over AgentPager, and waits: ${installPlaywrightQuestion.title}`,
    `Sam’s phone shows the agent’s card: ${installPlaywrightQuestion.title}, with Yes, install it chosen.`,
  ],
  getStarted: "Get started for free",
  steps: {
    app: ["Open on your phone", "Use AgentPager in your browser. Nothing to install."],
    tell: ["Tell your agent", "Paste this into any agent session:"],
    scan: [
      "Scan the QR code",
      "Open your agent’s link or QR code, choose its emoji, then press Send.",
    ],
  },
  download: "Open AgentPager",
  instruction: CARD_AGENT_INSTRUCTION,
  copy: "Copy",
  copiedShort: "Copied",
  copied: "Copied. Paste it to your agent.",
  made: "Made for humans and agents",
  madeIntro:
    "AgentPager is like a walkie-talkie you can give your agent running anywhere. So they can safely contact you for big decisions, instead of guessing or stopping.",
  features: [
    [
      "Works wherever agents can run",
      "Any harness, any machine: laptop, dev box, cloud VM, container. If it can show a QR code, it can page you.",
    ],
    [
      "Choose, then Send",
      "Not an agent chat. Each message is designed to be a quick decision. Approve, decline, or ask for changes.",
    ],
    [
      "Customize it for your work",
      "AgentPager provides the infrastructure to connect; you and your agents are fully in control of what decisions you send each other.",
    ],
  ],
  questions: "Questions",
  faq: [
    [
      "Which agents does it work with?",
      `It works in any agent client that can send HTTPS requests or add an MCP server. Start at ${PRODUCTION_ORIGIN}${ROUTES.start.path}`,
    ],
    [
      "I already get notifications from my agent app. Why do I need this?",
      "Maybe you don’t! AgentPager is useful when running agents in different apps or machines. If you find yourself “checking in” on long-running agent sessions anywhere, give them AgentPager to contact you instead.",
    ],
    [
      "What does it cost?",
      `AgentPager is free to use for one agent and up to ${SESSION_LIFETIME_MS / 3_600_000}-hour connections. A Pro plan from ${pro} is planned; it is not on sale yet. Email pro@agentpager.me with the features you want to see in Pro.`,
    ],
  ],
  cta: "Get AgentPager for free",
  ctaIntro: "Open your agent’s link, choose its emoji, then press Send. No install needed.",
  ctaButton: "Open AgentPager",
  ctaNote: "Free to use · Pro planned",
  copyright: "© 2026 AgentPager",
} as const;

// The product is a browser app; opening it requires no download.
const DOWNLOAD_HREF = ROUTES.homeApp.path;

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
                <p>{MARKETING.steps.app[1]}</p>
              </div>
              <a className="mk-action" href={DOWNLOAD_HREF}>
                {MARKETING.download}
              </a>
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
          <a className="mk-button" href={DOWNLOAD_HREF}>
            {MARKETING.ctaButton}
          </a>
          <small>{MARKETING.ctaNote}</small>
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
