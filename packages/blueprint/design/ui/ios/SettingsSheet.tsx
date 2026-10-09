import { useId } from "react";
import { ActionSheet, BackButton, Chevron, CloseButton, GlassButton, NavBar, Phone, Section, ShareIcon, Sheet } from "./kit.tsx";
import { WORDS, serverNow } from "./words.ts";

// Settings, from the gear: the phone's pager number, which agents the owner trusts use to open pagers that are
// paired from the start (a dogfood exception to SI2, DEC-2026-10-08-pager-number-dogfood); the server; and
// changing the number, after a confirmation.
export function SettingsSheet({ number, making, error, copied, server, status, confirmChange, dark }: { number?: string; making?: boolean; error?: string; copied?: boolean; server: string; status: string; confirmChange?: boolean; dark?: boolean }) {
  const footer = error ? (
    <>
      <p>{error}</p>
      <button type="button" className="text-btn">{WORDS.tryAgain}</button>
    </>
  ) : (
    WORDS.numberFooter
  );
  return (
    <Phone dark={dark} presenting label={WORDS.settings}>
      <Sheet label={WORDS.settings}>
        <NavBar title={WORDS.settings} trailing={<CloseButton />} />
        <div className="list">
          <Section header={WORDS.pagerNumber} footer={footer} footerAlarm={!!error}>
            <p className={number ? "cell mono" : "cell note-row"}>{number ?? (making ? WORDS.makingNumber : WORDS.noNumber)}</p>
            <button type="button" className={number ? "cell action" : "cell note-row"} disabled={!number}>{copied ? WORDS.copied : WORDS.copyForAgents}</button>
            <button type="button" className={number ? "cell action" : "cell note-row"} disabled={!number}><ShareIcon /><span className="cell-title">{WORDS.share}</span></button>
          </Section>
          <Section gap footer={serverNow(status)}>
            <button type="button" className="cell">
              <span className="cell-text"><span className="cell-title">{WORDS.server}</span></span>
              <span className="cell-value">{new URL(server).hostname}</span>
              <Chevron />
            </button>
          </Section>
          <Section gap footer={WORDS.changeNumberFooter}>
            <button type="button" className={number ? "cell destructive" : "cell note-row"} disabled={!number}>{WORDS.changeNumber}</button>
          </Section>
        </div>
        {confirmChange && <ActionSheet title={WORDS.changeNumberTitle} text={WORDS.changeNumberText} action={WORDS.changeNumberConfirm} cancel={WORDS.cancel} />}
      </Sheet>
    </Phone>
  );
}

// Server, pushed from Settings: the address of the AgentPager server this phone uses. Pagers and the pager
// number are kept per server.
export function ServerForm({ value, invalid, dark }: { value: string; invalid?: boolean; dark?: boolean }) {
  const id = useId();
  return (
    <Phone dark={dark} presenting label={WORDS.server}>
      <Sheet label={WORDS.settings}>
        <NavBar leading={<BackButton label={WORDS.settings} />} title={WORDS.server} trailing={<GlassButton label={WORDS.save} text />} />
        <div className="list">
          <label className="section-header" htmlFor={id}>{WORDS.serverHeader}</label>
          <div className="group">
            <input id={id} className="field" type="url" defaultValue={value} placeholder="http://192.168.1.10:8787" />
          </div>
          <p className={invalid ? "section-footer alarm" : "section-footer"}>{invalid ? WORDS.serverInvalid : WORDS.serverFooter}</p>
        </div>
      </Sheet>
    </Phone>
  );
}
