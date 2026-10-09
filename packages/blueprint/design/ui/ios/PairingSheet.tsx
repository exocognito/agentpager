import { PALETTE } from "./fixtures.ts";
import { CloseButton, FailedIcon, LinkIcon, NavBar, PairedIcon, Phone, Sheet, Spinner, Unavailable } from "./kit.tsx";
import { UNAVAILABLE, WORDS, pairedText, pairingHint, triesLeftText, wrongCode, type Unavailable as UnavailableKind } from "./words.ts";

export type PairingPhase = "loading" | "entering" | "checking" | "wrong" | "failed" | "paired" | "unavailable";
type Props = {
  name: string;
  phase: PairingPhase;
  entered?: readonly (string | null)[];
  focus?: number | null;
  triesLeft?: number;
  minutesLeft?: number;
  note?: string;
  unavailable?: UnavailableKind;
  endsIn?: string;
  dark?: boolean;
};

// Pairing: the owner taps the 3 emojis the agent shows, in order, from the pager's palette of 25, then Pair.
// Nothing submits on its own. Tapping a circle chooses which emoji to replace. The service counts 3 tries
// across the pager's first 15 minutes, and a third wrong try ends the pager.
export function PairingSheet({ name, phase, entered = [null, null, null], focus = null, triesLeft = 3, minutesLeft, note, unavailable = "waiting", endsIn = "24h", dark }: Props) {
  return (
    <Phone dark={dark} presenting label={WORDS.pairTitle}>
      <Sheet label={WORDS.pairTitle}>
        <NavBar small={name} trailing={<CloseButton />} />
        {phase === "loading" && <Spinner size={28} className="center-spinner" />}
        {phase === "failed" && (
          <Unavailable icon={<FailedIcon />} title={WORDS.pairingFailed}>
            <p>{WORDS.pairingFailedText}</p>
            <button type="button" className="btn-prominent auto">{WORDS.connectAgain}</button>
          </Unavailable>
        )}
        {phase === "paired" && (
          <Unavailable icon={<PairedIcon />} title={WORDS.paired}>
            <p>{pairedText(name, endsIn)}</p>
          </Unavailable>
        )}
        {phase === "unavailable" && (
          <Unavailable icon={<LinkIcon />} title={UNAVAILABLE[unavailable][0]}>
            <p>{UNAVAILABLE[unavailable][1]}</p>
          </Unavailable>
        )}
        {(phase === "entering" || phase === "checking" || phase === "wrong") && (
          <Pad phase={phase} entered={entered} focus={focus} triesLeft={triesLeft} minutesLeft={minutesLeft} note={note} />
        )}
      </Sheet>
    </Phone>
  );
}

const NAMES = new Map(PALETTE);

function Pad({ phase, entered, focus, triesLeft, minutesLeft, note }: { phase: "entering" | "checking" | "wrong"; entered: readonly (string | null)[]; focus: number | null; triesLeft: number; minutesLeft?: number; note?: string }) {
  const full = entered.every((e) => e !== null);
  const status = note ?? (phase === "checking" ? WORDS.checking : phase === "wrong" ? wrongCode(triesLeft) : triesLeft === 1 ? WORDS.lastTry : triesLeft < 3 ? triesLeftText(triesLeft) : pairingHint(minutesLeft));
  const alarm = note === undefined && phase !== "checking" && (phase === "wrong" || triesLeft === 1);
  return (
    <>
      <h2 className="sheet-title">{WORDS.pairTitle}</h2>
      <p className="sheet-body">{WORDS.pairIntro}</p>
      <div className="slots">
        {entered.map((emoji, i) => {
          const state = phase === "wrong" ? " wrong" : phase === "entering" && focus === i ? " focused" : "";
          return (
            <button key={i} type="button" className={`slot${state}`} disabled={phase === "checking"} aria-pressed={phase === "entering" && focus === i} aria-label={`Emoji ${i + 1}: ${emoji ? NAMES.get(emoji) : "empty"}. Tap to change.`}>
              {emoji}
            </button>
          );
        })}
      </div>
      <p role="status" className={alarm ? "pair-status alarm" : "pair-status"}>{status}</p>
      <div className="palette" role="group" aria-label={WORDS.palette}>
        {PALETTE.map(([emoji, label]) => (
          <button key={emoji} type="button" aria-label={label} disabled={phase === "checking" || (phase === "entering" && focus === null)}>{emoji}</button>
        ))}
      </div>
      <div className="bottom-bar">
        <button type="button" className="btn-prominent" disabled={!full || phase !== "entering"}>{phase === "checking" ? WORDS.checking : WORDS.pair}</button>
      </div>
    </>
  );
}
