import { DialogBox } from './DialogBox';
import { RulesContent } from './RulesContent';

/** Shown once, right after a brand-new account signs up — same content as
 * the "📖 Rules" popup, just framed as a full scene with a continue button. */
export function RulesScene({ onContinue }: { onContinue: () => void }) {
  return (
    <div className="scene rules-scene">
      <DialogBox speaker="PROF. OAK">
        Welcome to PokéBrawl! Before your journey begins, here's how everything works:
      </DialogBox>
      <RulesContent />
      <button className="press-start" onClick={onContinue}>
        GOT IT ▶
      </button>
    </div>
  );
}
