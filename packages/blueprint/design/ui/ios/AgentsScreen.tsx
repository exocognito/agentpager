import { LogoMark } from "../components/LogoMark.tsx";
import type { Pager } from "./fixtures.ts";
import { Chevron, GearIcon, GlassButton, NavBar, Phone, PlusIcon, Section, Unavailable } from "./kit.tsx";
import { WORDS, subtitle } from "./words.ts";

// Agents: every pager this phone holds, active ones first, then those ended in the last 24 hours. A row that is
// not paired yet opens pairing; the others open the agent. A status pill shows only while the server can't be
// reached (trouble); + connects another agent.
export function AgentsScreen({ agents, trouble, now, dark }: { agents: Pager[]; trouble?: string; now: Date; dark?: boolean }) {
  const active = agents.filter((p) => p.status !== "ended");
  const ended = agents.filter((p) => p.status === "ended");
  return (
    <Phone dark={dark} label={WORDS.agents}>
      <div className="safe-top" />
      <NavBar trailing={<GlassButton label={WORDS.settings}><GearIcon /></GlassButton>} />
      <h1 className="large-title">{WORDS.agents}</h1>
      {agents.length === 0 ? (
        <>
          <Unavailable icon={<LogoMark size={64} />} title={WORDS.noAgents}>
            <p>{WORDS.noAgentsText}</p>
          </Unavailable>
          <div className="toolbar end">
            <GlassButton label={WORDS.connectAgent} tinted round><PlusIcon /></GlassButton>
          </div>
        </>
      ) : (
        <>
          <div className="list">
            {active.length > 0 && <Section header={WORDS.activePagers} sep="dot">{active.map((p) => <AgentRow key={p.sessionId} pager={p} now={now} />)}</Section>}
            {ended.length > 0 && <Section header={WORDS.endedPagers} footer={WORDS.endedFooter} sep="dot">{ended.map((p) => <AgentRow key={p.sessionId} pager={p} now={now} />)}</Section>}
          </div>
          <div className="toolbar">
            <span className="toolbar-spacer" />
            {trouble ? <div className="glass-pill status" role="status">{trouble}</div> : <span />}
            <GlassButton label={WORDS.connectAgent} tinted round><PlusIcon /></GlassButton>
          </div>
        </>
      )}
    </Phone>
  );
}

const DOT = { active: "green", unpaired: "orange", waiting: "orange", ended: "gray" } as const;

function AgentRow({ pager, now }: { pager: Pager; now: Date }) {
  const count = pager.status === "active" && pager.openCount ? pager.openCount : undefined;
  return (
    <button type="button" className="cell">
      <span className={`dot ${DOT[pager.status]}`} />
      <span className="cell-text">
        <span className={pager.status === "ended" ? "cell-title one-line" : "cell-title strong one-line"}>{pager.name}</span>
        <span className="cell-sub one-line">{subtitle(pager, now)}</span>
      </span>
      {count && <span className="cell-value">{count}</span>}
      <Chevron />
    </button>
  );
}
