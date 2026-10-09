import type { ReactNode } from "react";
import { WORDS } from "./words.ts";
import "./ios.css";

// The system pieces every screen uses, drawn as the canvas draws them. Stories are still pictures: buttons
// do nothing, and each state is its own story.

export function Phone({ dark, presenting, web, label, children }: { dark?: boolean; presenting?: boolean; web?: boolean; label: string; children: ReactNode }) {
  const className = ["ios", presenting && "presenting", web && "web", dark && "dark"].filter(Boolean).join(" ");
  return (
    <div className={className} role="group" aria-label={label}>
      {children}
    </div>
  );
}

export function NavBar({ title, subtitle, small, leading, trailing }: { title?: string; subtitle?: string; small?: string; leading?: ReactNode; trailing?: ReactNode }) {
  return (
    <div className="navbar">
      {leading ?? <span className="navbar-spacer" />}
      <span className="navbar-title">
        {title && <strong>{title}</strong>}
        {(subtitle ?? small) && <small>{subtitle ?? small}</small>}
      </span>
      {trailing ?? <span className="navbar-spacer" />}
    </div>
  );
}

// An icon button names itself with label; a text button (text) shows its label instead.
export function GlassButton({ label, tinted, round, text, disabled, children }: { label: string; tinted?: boolean; round?: boolean; text?: boolean; disabled?: boolean; children?: ReactNode }) {
  const className = ["glass-btn", tinted && "tinted", round && "round", text && "text"].filter(Boolean).join(" ");
  return (
    <button type="button" className={className} aria-label={text ? undefined : label} disabled={disabled}>
      {text && label}
      {children}
    </button>
  );
}

export const BackButton = ({ label = WORDS.back }: { label?: string }) => <GlassButton label={label}><BackIcon /></GlassButton>;
export const CloseButton = ({ label = WORDS.close }: { label?: string }) => <GlassButton label={label}><CloseIcon /></GlassButton>;

// sep names what leads each row, so the separators start after it: a status dot, an emoji or an icon.
export function Section({ header, footer, footerAlarm, sep, gap, children }: { header?: string; footer?: ReactNode; footerAlarm?: boolean; sep?: "dot" | "emoji" | "icon"; gap?: boolean; children: ReactNode }) {
  const className = ["group", sep && `sep-${sep}`, gap && "gap"].filter(Boolean).join(" ");
  return (
    <div>
      {header && <h2 className="section-header">{header}</h2>}
      <div className={className}>
        {children}
      </div>
      {footer && <div className={footerAlarm ? "section-footer alarm" : "section-footer"}>{footer}</div>}
    </div>
  );
}

export function Sheet({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <div className="behind" />
      <div className="sheet" role="dialog" aria-label={label}>
        <div className="grabber" />
        {children}
      </div>
    </>
  );
}

export function Unavailable({ icon, title, lead, children }: { icon: ReactNode; title: string; lead?: string; children?: ReactNode }) {
  return (
    <div className="unavailable">
      {icon}
      <h2>{title}</h2>
      {lead && <p className="lead">{lead}</p>}
      {children}
    </div>
  );
}

export function Alert({ title, text, cancel, action }: { title: string; text: string; cancel: string; action: string }) {
  return (
    <div className="alert-wrap">
      <div className="alert" role="alertdialog" aria-label={title}>
        <h2>{title}</h2>
        <p>{text}</p>
        <div className="alert-actions">
          <button type="button" className="alert-btn">{cancel}</button>
          <button type="button" className="alert-btn primary">{action}</button>
        </div>
      </div>
    </div>
  );
}

export function ActionSheet({ title, text, action, cancel }: { title: string; text: string; action: string; cancel: string }) {
  return (
    <>
      <div className="scrim" />
      <div className="action-sheet" role="dialog" aria-label={title}>
        <div className="as-group">
          <p className="as-message"><strong>{title}</strong>{text}</p>
          <button type="button" className="as-btn destructive">{action}</button>
        </div>
        <div className="as-group">
          <button type="button" className="as-btn cancel">{cancel}</button>
        </div>
      </div>
    </>
  );
}

// Icons stand in for the SF Symbols the app uses; each names its symbol.
type IconProps = { size?: number; className?: string; label?: string };
const a11y = (label?: string) => (label ? { role: "img", "aria-label": label } : { "aria-hidden": true as const });

// chevron.right
export const Chevron = () => (
  <svg className="chev" width="8" height="14" viewBox="0 0 8 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m1.5 1.5 5.5 5.5-5.5 5.5" /></svg>
);
// chevron.left
export const BackIcon = () => (
  <svg width="11" height="19" viewBox="0 0 11 19" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 2 2 9.5 9 17" /></svg>
);
// xmark
export const CloseIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="m2 2 10 10M12 2 2 12" /></svg>
);
// ellipsis
export const MoreIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><circle cx="4" cy="10" r="1.9" /><circle cx="10" cy="10" r="1.9" /><circle cx="16" cy="10" r="1.9" /></svg>
);
// plus
export const PlusIcon = () => (
  <svg width="22" height="22" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M10 3.5v13M3.5 10h13" /></svg>
);
// gearshape
export const GearIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3.2" />
    <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
    <circle cx="12" cy="12" r="6.6" />
  </svg>
);
// checkmark
export const CheckIcon = ({ size = 20, className = "check", label }: IconProps) => (
  <svg className={className} width={size} height={size} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" {...a11y(label)}><path d="m3 9.5 4 4 8-9" /></svg>
);
// clock
export const ClockIcon = ({ size = 16 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8.5" /><path d="M11 6.5V11l3 2" /></svg>
);
// square.and.arrow.up
export const ShareIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3v12M7.5 7.5 12 3l4.5 4.5M5 11v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" /></svg>
);
// chevron.up.chevron.down
export const UpDownIcon = () => (
  <svg width="10" height="16" viewBox="0 0 10 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m1.5 5.5 3.5-3.5 3.5 3.5M1.5 10.5 5 14l3.5-3.5" /></svg>
);
// xmark.circle
export const XCircleIcon = () => (
  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="8.5" /><path d="m8 8 6 6M14 8l-6 6" /></svg>
);
// text.bubble, for an answer that was a note
export const NoteIcon = ({ size = 20 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z" /><path d="M8 8h8M8 12h5" /></svg>
);
// bubble.left, on the Ask for Changes row
export const BubbleIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 15a2 2 0 0 1-2 2H8l-4 4V5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z" /></svg>
);
// arrow.up
export const ArrowUpIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 15V3M3.5 8.5 9 3l5.5 5.5" /></svg>
);
// antenna.radiowaves.left.and.right, the empty Agents list
export const AntennaIcon = () => (
  <svg className="icon" width="60" height="60" viewBox="0 0 60 60" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="30" cy="26" r="4" /><path d="M30 30v22M20 16a14 14 0 0 0 0 20M40 16a14 14 0 0 1 0 20M13 9a24 24 0 0 0 0 34M47 9a24 24 0 0 1 0 34" /></svg>
);
// clock.badge.xmark, an ended pager
export const EndedIcon = () => (
  <svg className="icon" width="60" height="60" viewBox="0 0 60 60" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M44 26a20 20 0 1 0-18 26" /><path d="M28 18v12l7 5" /><path d="m40 40 12 12M52 40 40 52" /></svg>
);
// xmark.circle, pairing failed
export const FailedIcon = () => (
  <svg className="icon red" width="60" height="60" viewBox="0 0 60 60" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><circle cx="30" cy="30" r="22" /><path d="m22 22 16 16M38 22 22 38" /></svg>
);
// checkmark.circle.fill, paired
export const PairedIcon = () => (
  <svg className="icon green" width="64" height="64" viewBox="0 0 34 34" aria-hidden="true"><circle cx="17" cy="17" r="17" fill="currentColor" /><path d="m10 17.5 4.5 4.5 9.5-10" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
// link, a link that can't be paired
export const LinkIcon = () => (
  <svg className="icon" width="60" height="60" viewBox="0 0 60 60" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M26 34a10 10 0 0 0 14 0l8-8a10 10 0 0 0-14-14l-3 3" /><path d="M34 26a10 10 0 0 0-14 0l-8 8a10 10 0 0 0 14 14l3-3" /></svg>
);
// tray, a decision that is no longer there
export const TrayIcon = () => (
  <svg className="icon" width="60" height="60" viewBox="0 0 60 60" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 34 16 12h28l8 22v14H8Z" /><path d="M8 34h14a8 8 0 0 0 16 0h14" /></svg>
);
// ProgressView
export const Spinner = ({ size = 16, className = "" }: IconProps) => (
  <svg className={`spinner ${className}`} width={size} height={size} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M10 2a8 8 0 1 0 8 8" /></svg>
);
