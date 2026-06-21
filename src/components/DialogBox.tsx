import type { ReactNode } from 'react';

/** Classic Pokémon-style dialogue box for NPC / system text. */
export function DialogBox({ speaker, children }: { speaker?: string; children: ReactNode }) {
  return (
    <div className="dialog">
      {speaker && <div className="dialog-speaker">{speaker}</div>}
      <div className="dialog-text">{children}</div>
    </div>
  );
}
