// AUTO-GENERATED from local character packs. Front-facing idle frames live in public/trainers/.
export interface Trainer { id: string; label: string; frames: number; }
export const TRAINERS: Trainer[] = [
  { id: 'necromancer-free-files-female-char-1-type-1', label: 'Necromancer Female Char 1 Type 1', frames: 4 },
  { id: 'necromancer-free-files-female-char-2-type-1', label: 'Necromancer Female Char 2 Type 1', frames: 4 },
  { id: 'necromancer-free-files-female-char-3-type-1', label: 'Necromancer Female Char 3 Type 1', frames: 4 },
  { id: 'nes-druid-female-free-files-char-1-type-1', label: 'Druid Female Char 1 Type 1', frames: 4 },
  { id: 'nes-druid-female-free-files-char-2-type-1', label: 'Druid Female Char 2 Type 1', frames: 4 },
  { id: 'nes-druid-female-free-files-char-3-type-1', label: 'Druid Female Char 3 Type 1', frames: 4 },
  { id: 'nes-me-knights-x2-characters-free-1-t-orbon-type-3', label: 'ME Knights X2 #1 T Orbon TYPE 3', frames: 5 },
  { id: 'sms-necromancer-free-files-char-1-type-1', label: 'Necromancer Char 1 Type 1', frames: 4 },
  { id: 'sms-necromancer-free-files-char-2-type-1', label: 'Necromancer Char 2 Type 1', frames: 4 },
  { id: 'sms-necromancer-free-files-char-3-type-1', label: 'Necromancer Char 3 Type 1', frames: 4 },
  { id: 'x5-characters-knight-2-1-t-orbon-type-1', label: 'X5 Knight #2 #1 T Orbon Type 1', frames: 4 },
  { id: 'x5-characters-knight-2-11-m-edwards-type-1', label: 'X5 Knight #2 #11 M Edwards Type 1', frames: 4 },
  { id: 'x5-characters-knight-2-2-w-mills-type-1', label: 'X5 Knight #2 #2 W Mills Type 1', frames: 4 },
  { id: 'x5-characters-knight-2-21-c-smith-type-1', label: 'X5 Knight #2 #21 C Smith Type 1', frames: 4 },
  { id: 'x5-characters-knight-2-30-a-abdi-type-1', label: 'X5 Knight #2 #30 A Abdi Type 1', frames: 4 },
  { id: 'x5-characters-lord-1-t-orbon-type-1', label: 'X5 Lord #1 T Orbon Type 1', frames: 4 },
  { id: 'x5-characters-lord-11-m-edwards-type-1', label: 'X5 Lord #11 M Edwards Type 1', frames: 4 },
  { id: 'x5-characters-lord-2-w-mills-type-1', label: 'X5 Lord #2 W Mills Type 1', frames: 4 },
  { id: 'x5-characters-lord-21-c-smith-type-1', label: 'X5 Lord #21 C Smith Type 1', frames: 4 },
  { id: 'x5-characters-lord-30-a-abdi-type-1', label: 'X5 Lord #30 A Abdi Type 1', frames: 4 },
  { id: 'x5-characters-princess-31-l-george-type-1', label: 'X5 Princess #31 L George Type 1', frames: 4 },
  { id: 'x5-characters-princess-32-m-mcshane-type-1', label: 'X5 Princess #32 M Mcshane Type 1', frames: 4 },
  { id: 'x5-characters-princess-33-l-woods-type-1', label: 'X5 Princess #33 L Woods Type 1', frames: 4 },
  { id: 'x5-characters-princess-36-a-moore-type-1', label: 'X5 Princess #36 A Moore Type 1', frames: 4 },
  { id: 'x5-characters-princess-41-c-ballard-type-1', label: 'X5 Princess #41 C Ballard Type 1', frames: 4 },
  { id: 'x5-characters-r-servant-1-t-orbon-type-1', label: 'X5 R Servant #1 T Orbon Type 1', frames: 4 },
  { id: 'x5-characters-r-servant-11-m-edwards-type-1', label: 'X5 R Servant #11 M Edwards Type 1', frames: 4 },
  { id: 'x5-characters-r-servant-2-w-mills-type-1', label: 'X5 R Servant #2 W Mills Type 1', frames: 4 },
  { id: 'x5-characters-r-servant-21-c-smith-type-1', label: 'X5 R Servant #21 C Smith Type 1', frames: 4 },
  { id: 'x5-characters-r-servant-30-a-abdi-type-1', label: 'X5 R Servant #30 A Abdi Type 1', frames: 4 },
];
export const DEFAULT_TRAINER = TRAINERS[0]?.id ?? '';
export function trainerFrame(id: string, frame: number): string {
  return `${import.meta.env.BASE_URL}trainers/${id}/idle_${frame}.png`;
}
export function trainerFrames(id: string): number {
  return TRAINERS.find((t) => t.id === id)?.frames ?? 1;
}
