export type IntervalKey =
  | 'Starting'
  | 'Transition1'
  | 'Second'
  | 'Transition2'
  | 'Finish';

export type PlayerIntervalState = 'full' | 'first' | 'second' | 'bench';

export interface Player {
  id: string;
  name: string;
  active: boolean;
}

export type LineupSlot =
  | {
      id: string;
      kind: 'full';
      playerId: string;
    }
  | {
      id: string;
      kind: 'split';
      firstId: string | null;
      secondId: string | null;
    };

export interface GamePlan {
  players: Player[];
  lineups: Record<IntervalKey, LineupSlot[]>;
}

export interface IntervalMeta {
  key: IntervalKey;
  label: string;
  range: string;
}

export const INTERVALS: IntervalMeta[] = [
  { key: 'Starting', label: 'Starting', range: '0–4' },
  { key: 'Transition1', label: 'Transition 1', range: '4–8' },
  { key: 'Second', label: 'Second', range: '8–12' },
  { key: 'Transition2', label: 'Transition 2', range: '12–16' },
  { key: 'Finish', label: 'Finish', range: '16–20' },
];

export const DEFAULT_GAME_PLAN: GamePlan = {
  players: [
    { id: 'tim', name: 'Tim', active: true },
    { id: 'timmy', name: 'Timmy', active: true },
    { id: 'kevin', name: 'Kevin', active: true },
    { id: 'tom', name: 'Tom', active: true },
    { id: 'julius', name: 'Julius', active: true },
    { id: 'jimmy', name: 'Jimmy', active: true },
    { id: 'alex', name: 'Alex', active: true },
    { id: 'julian', name: 'Julian', active: true },
    { id: 'luca', name: 'Luca', active: true },
    { id: 'bjoern', name: 'Björn', active: true },
  ],
  lineups: {
    Starting: [
      { id: 'st-1', kind: 'full', playerId: 'tim' },
      { id: 'st-2', kind: 'full', playerId: 'alex' },
      { id: 'st-3', kind: 'full', playerId: 'julius' },
      { id: 'st-4', kind: 'full', playerId: 'julian' },
      { id: 'st-5', kind: 'full', playerId: 'tom' },
    ],
    Transition1: [
      { id: 't1-1', kind: 'full', playerId: 'luca' },
      { id: 't1-2', kind: 'full', playerId: 'tim' },
      { id: 't1-3', kind: 'split', firstId: 'alex', secondId: 'timmy' },
      { id: 't1-4', kind: 'full', playerId: 'kevin' },
      { id: 't1-5', kind: 'full', playerId: 'julius' },
    ],
    Second: [
      { id: 'sc-1', kind: 'full', playerId: 'julian' },
      { id: 'sc-2', kind: 'full', playerId: 'timmy' },
      { id: 'sc-3', kind: 'full', playerId: 'tom' },
      { id: 'sc-4', kind: 'full', playerId: 'kevin' },
      { id: 'sc-5', kind: 'full', playerId: 'jimmy' },
    ],
    Transition2: [
      { id: 't2-1', kind: 'full', playerId: 'luca' },
      { id: 't2-2', kind: 'split', firstId: 'timmy', secondId: 'alex' },
      { id: 't2-3', kind: 'full', playerId: 'tim' },
      { id: 't2-4', kind: 'full', playerId: 'jimmy' },
      { id: 't2-5', kind: 'full', playerId: 'bjoern' },
    ],
    Finish: [
      { id: 'fn-1', kind: 'full', playerId: 'julian' },
      { id: 'fn-2', kind: 'full', playerId: 'alex' },
      { id: 'fn-3', kind: 'full', playerId: 'tim' },
      { id: 'fn-4', kind: 'full', playerId: 'julius' },
      { id: 'fn-5', kind: 'full', playerId: 'luca' },
    ],
  },
};
