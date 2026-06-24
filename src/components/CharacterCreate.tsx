import { useState } from 'react';
import { TRAINERS, DEFAULT_TRAINER } from '../data/trainers';
import { TrainerSprite } from './TrainerSprite';
import { DialogBox } from './DialogBox';

/** Trainer-sprite picker, shown once right after a brand-new account's first
 * sign-up (the trainer's name is the account username, set at sign-up). */
export function CharacterCreate({ onCreate }: { onCreate: (trainer: string) => void }) {
  const [trainer, setTrainer] = useState(DEFAULT_TRAINER);

  return (
    <div className="scene create-scene">
      <DialogBox speaker="PROF. OAK">
        Choose your trainer, and your POKéMON journey will begin!
      </DialogBox>

      <div className="creator">
        <div className="creator-preview">
          <div className="avatar-stage">
            <TrainerSprite id={trainer} size={150} animated />
          </div>

          <button className="press-start" onClick={() => onCreate(trainer)}>
            CONFIRM ▶
          </button>
        </div>

        <div className="trainer-gallery">
          {TRAINERS.map((t) => (
            <button
              key={t.id}
              className={`trainer-cell ${t.id === trainer ? 'sel' : ''}`}
              onClick={() => setTrainer(t.id)}
            >
              <TrainerSprite id={t.id} size={44} animated={t.id === trainer} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
