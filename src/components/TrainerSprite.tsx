import { useEffect, useState } from 'react';
import { trainerFrame, trainerFrames } from '../data/trainers';

/** Front-facing trainer sprite. Loops the idle animation when `animated`. */
export function TrainerSprite({
  id,
  size = 64,
  animated = true,
}: {
  id: string;
  size?: number;
  animated?: boolean;
}) {
  const frames = trainerFrames(id);
  const [f, setF] = useState(0);

  useEffect(() => {
    setF(0);
    if (!animated || frames <= 1) return;
    const t = setInterval(() => setF((p) => (p + 1) % frames), 280);
    return () => clearInterval(t);
  }, [id, animated, frames]);

  return (
    <img
      src={trainerFrame(id, animated ? f : 0)}
      alt=""
      width={size}
      height={Math.round((size * 32) / 24)}
      className="pixel trainer-sprite-img"
      draggable={false}
    />
  );
}
