import { QrPicture } from "../components/QrPicture.tsx";
import { CheckIcon, ClockIcon, CloseButton, NavBar, Phone, Section, ShareIcon, Sheet, Spinner, UpDownIcon } from "./kit.tsx";
import { LIFETIME, LIFETIMES, WORDS, type Lifetime } from "./words.ts";

// Connect an Agent, from +: the phone makes an AgentPager link, shown as a QR code and as text, to give to an
// agent. The lifetime applies from when the agent connects. An agent's own link is scanned with the Camera.
export function ConnectSheet({ link, lifetime = "24h", menuOpen, copied, error, dark }: { link?: string; lifetime?: Lifetime; menuOpen?: boolean; copied?: boolean; error?: string; dark?: boolean }) {
  const footer = error ? (
    <>
      <p>{error}</p>
      <button type="button" className="text-btn">{WORDS.tryAgain}</button>
    </>
  ) : (
    LIFETIME[lifetime].note
  );
  return (
    <Phone dark={dark} presenting label={WORDS.connectTitle}>
      <Sheet label={WORDS.connectTitle}>
        <NavBar title={WORDS.connectTitle} trailing={<CloseButton />} />
        <p className="sheet-body center">{WORDS.connectIntro}</p>
        <div className="qr-wrap">
          {link ? (
            <div className="qr" role="img" aria-label={WORDS.qrLabel}><QrPicture className="qr-code" /></div>
          ) : (
            <div className="qr">{!error && <Spinner size={24} />}</div>
          )}
        </div>
        <div className="list">
          <Section header={WORDS.linkHeader} sep="icon" footer={footer} footerAlarm={!!error}>
            <div className="cell">
              <span className={link ? "cell-text mono" : "cell-text note-row"}>{link ?? WORDS.makingLink}</span>
              <button type="button" className="btn-gray small" disabled={!link}>{copied ? WORDS.copied : WORDS.copy}</button>
            </div>
            <button type="button" className="cell" aria-haspopup="menu" aria-expanded={!!menuOpen} disabled={!link}>
              <ClockIcon size={22} />
              <span className="cell-text"><span className="cell-title">{WORDS.pagerEndsAfter}</span></span>
              <span className="menu-value">{LIFETIME[lifetime].label}<UpDownIcon /></span>
            </button>
            <button type="button" className={link ? "cell action" : "cell note-row"} disabled={!link}>
              <ShareIcon />
              <span className="cell-title">{WORDS.shareLink}</span>
            </button>
          </Section>
        </div>
        {menuOpen && (
          <>
            <button type="button" className="menu-close" aria-label={WORDS.close} />
            <div className="menu" role="menu" aria-label={WORDS.pagerEndsAfter} style={{ top: 460, right: 32, width: 230 }}>
              {LIFETIMES.map((l) => (
                <button key={l} type="button" className="menu-item radio" role="menuitemradio" aria-checked={l === lifetime}>
                  <span className="menu-check">{l === lifetime && <CheckIcon size={16} className="" />}</span>
                  {LIFETIME[l].label}
                </button>
              ))}
            </div>
          </>
        )}
      </Sheet>
    </Phone>
  );
}
