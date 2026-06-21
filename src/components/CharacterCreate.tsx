import { useState } from 'react';
import { TRAINERS, DEFAULT_TRAINER } from '../data/trainers';
import { TrainerSprite } from './TrainerSprite';
import { DialogBox } from './DialogBox';

const MAX_NAME = 12;

export function CharacterCreate({
  onCreate,
}: {
  onCreate: (name: string, trainer: string) => void;
}) {
  const [name, setName] = useState('');
  const [trainer, setTrainer] = useState(DEFAULT_TRAINER);
  const clean = name.trim();

  return (
    <div className="scene create-scene">
      <DialogBox speaker="PROF. OAK">
        Choose your trainer and tell me your name, and your POKéMON journey will begin!
      </DialogBox>

      <div className="creator">
        <div className="creator-preview">
          <div className="avatar-stage">
            <TrainerSprite id={trainer} size={150} animated />
          </div>

          <label className="field">
            YOUR NAME
            <input
              className="retro-input"
              maxLength={MAX_NAME}
              value={name}
              placeholder="ENTER NAME"
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </label>

          <button className="press-start" disabled={!clean} onClick={() => onCreate(clean, trainer)}>
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
