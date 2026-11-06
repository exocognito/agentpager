import { useRef, useState } from "react";
import "./marketing.css";
import "./cards.css";
import { LogoMark } from "./LogoMark.tsx";
import { QrPicture } from "./QrPicture.tsx";
import { CopyIcon } from "./CopyIcon.tsx";
import { isDevHost } from "../dev.ts";

const PRODUCTION_ORIGIN = "https://agentpager.me",
  host = new URL(PRODUCTION_ORIGIN).host,
  pro = "$2.99/mo";

// The page's example decision: one easy yes or no.
const EXAMPLE = {
  title: "Install Playwright?",
  detail: "I need it to screenshot the new signup page. It’s a free tool that lets me drive a browser.",
  options: [
    ["👍", "Yes, install it"],
    ["⏭️", "Skip the screenshots"],
    ["✋", "Wait until I’m back"],
  ],
} as const;


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
    asked: `Asked Sam: ${EXAMPLE.title}`,
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
    `The agent finds it needs Sam’s OK to install software, asks him over AgentPager, and waits: ${EXAMPLE.title}`,
    `Sam’s iPhone shows the agent’s card: ${EXAMPLE.title}, with ${EXAMPLE.options[0][1]} chosen.`,
  ],
  getStarted: "Get started for free",
  steps: {
    app: ["Get AgentPager for iPhone", "Coming free to the App Store. Everything else happens in the app."],
    tell: ["Tell your agent", "Paste this into any agent session:"],
    scan: [
      "Pair",
      "Open your agent’s link on your iPhone, or scan its QR code with the Camera, and tap Open in AgentPager. Tap the three emojis your agent showed you, in order, then press Pair.",
    ],
  },
  download: "Download",
  comingSoon: "Coming to the App Store",
  instruction: `Connect AgentPager at ${host}/start`,
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
      `Any agent client that can send HTTPS requests or add an MCP server. It starts at ${PRODUCTION_ORIGIN}/start`,
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

// The phone: the retired web app's card screen (cards.css) with the example open and its first option chosen. It is
// a still picture, kept until the front page is redrawn for the iPhone app (L21, blueprint/areas/7-getting-started.md):
// nothing in it can take focus.
function CardPicture() {
  const expires = new Date("2026-09-30T06:00:00.000Z").toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <div className="ap-app ap-rich" data-theme="system">
      <div className="ap-base" inert>
        <nav className="ap-nav" aria-label="Primary">
          <div className="ap-nav-left">
            <a className="ap-back" href="/app" aria-label="All sessions">
              <svg width="13" height="21" viewBox="0 0 13 21" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M10.5 2.5 2.5 10.5l8 8" />
              </svg>
            </a>
          </div>
          <div className="ap-nav-center">
            <h1 className="ap-session-name" tabIndex={0}>Claude Code · blueprint</h1>
          </div>
          <div className="ap-nav-right">
            <button className="ap-session-status" disabled>
              <span />
              Active
            </button>
          </div>
        </nav>
        <main className="ap-scroll">
          <div className="ap-column ap-session-column">
            <section aria-labelledby="ap-open">
              <div className="ap-section-heading">
                <h2 id="ap-open" className="ap-section-label">Open decisions</h2>
                <span>1 waiting</span>
              </div>
              <div className="ap-group">
                <button className="ap-row ap-decision-row" aria-haspopup="dialog">
                  <span className="ap-mark ap-mark-open" aria-hidden="true" />
                  <span className="ap-row-text">
                    <strong>{EXAMPLE.title}</strong>
                    <small>{EXAMPLE.detail}</small>
                  </span>
                  <svg width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m1.5 1.5 5.5 5.5-5.5 5.5" />
                  </svg>
                </button>
              </div>
            </section>
            <footer className="ap-session-footer">
              <button className="ap-text-button ap-destructive">End session</button>
              <p>Session expires {expires}</p>
            </footer>
          </div>
        </main>
      </div>
      <div className="ap-overlay">
        <button className="ap-backdrop" tabIndex={-1} aria-label="Close overlay" />
        <div className="ap-tray" role="dialog" aria-modal="true" aria-label={EXAMPLE.title} tabIndex={-1}>
          <div className="ap-grabber" aria-hidden="true" />
          <div className="ap-answer-scroll" tabIndex={0}>
            <header className="ap-sheet-head">
              <h2>{EXAMPLE.title}</h2>
              <button className="ap-round ap-close" aria-label="Close decision">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="m2 2 8 8m0-8-8 8" />
                </svg>
              </button>
            </header>
            <div className="ap-about">
              <p className="ap-clamp">{EXAMPLE.detail}</p>
            </div>
            <div className="ap-options" role="group" aria-label="Choices">
              {EXAMPLE.options.map(([emoji, title], index) => (
                <button key={title} className="ap-option" aria-label={`Choose ${index + 1}: ${title}`} aria-pressed={index === 0}>
                  <span className="ap-option-emoji" aria-hidden="true">{emoji}</span>
                  <span className="ap-option-copy">
                    <strong>{title}</strong>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="ap-card-actions">
            <button className="ap-primary">Send</button>
            <button className="ap-text-button">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z" />
              </svg>
              Ask for changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const Brand = () => (
  <a className="mk-brand" href="/">
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

// The page at `/`. The product serves this screen; a check reads these strings back. `host` is the one it is served
// from, which says whether it is dev.
export function MarketingScreen({
  host: servedFrom = "",
  copyText = (text) => navigator.clipboard.writeText(text),
}: {
  host?: string;
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
      {isDevHost(servedFrom) && (
        <p className="mk-dev" role="note">
          <strong>dev</strong>
          This is {servedFrom}, a dev server for testing AgentPager, not {host}.
        </p>
      )}
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
                      <CardPicture />
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
