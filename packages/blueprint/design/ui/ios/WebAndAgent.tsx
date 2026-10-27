import { CODE, LINK, PALETTE } from "./fixtures.ts";
import { Phone } from "./kit.tsx";
import { WORDS, pairingHint } from "./words.ts";

// The page an AgentPager link opens in a phone's browser. Its button opens the app at that link. The
// instructions for agents follow, open, for agents that read the page in a browser; their words live with
// the service (packages/app, codeDocument), so only their start is drawn here.
export function LinkPage({ dark }: { dark?: boolean }) {
  return (
    <Phone dark={dark} web label={WORDS.linkPageTitle}>
      <div className="web-page">
        <h1>{WORDS.linkPageTitle}</h1>
        <p>{WORDS.linkPageText}</p>
        <a className="btn-prominent" href={LINK.replace("https://agentpager.me/", "agentpager://")}>{WORDS.openInApp}</a>
        <p>{WORDS.noApp}</p>
        <details open>
          <summary>{WORDS.areYouAnAgent}</summary>
          <pre>{`# AgentPager link\n\nYour owner's phone made this AgentPager link for you on \`https://agentpager.me\`. Reading this page uses nothing up.\n\nJoin it once, now:\n- HTTP: curl -s -X POST https://agentpager.me/api/start/…/join …\n…`}</pre>
        </details>
      </div>
    </Phone>
  );
}

const names = new Map(PALETTE);

// What an agent shows after joining the owner's link: the pairing code as the service words it
// (packages/app, pairingCode), written in the agent's own message.
export function AgentTerminal() {
  return (
    <div className="ios terminal" role="group" aria-label="What your agent shows">
      <p className="muted">~/projects/agentpager $ codex</p>
      <p>› Connect to my AgentPager: {LINK}</p>
      <p className="muted">• Read {LINK} (instructions only, nothing used up)</p>
      <p className="muted">• AgentPager · join_session</p>
      <div className="box">
        <p className="ok">● Connected to your AgentPager.</p>
        <p>To finish pairing, tap these 3 emojis on your phone, in this order:</p>
        <p className="big">{CODE.join(" ")}</p>
        <p className="pre">({CODE.map((e, i) => `${i + 1}. ${names.get(e)}`).join("    ")})</p>
        <p>3 tries. {pairingHint(15)}</p>
      </div>
      <p className="muted">Waiting for you to pair…</p>
    </div>
  );
}
