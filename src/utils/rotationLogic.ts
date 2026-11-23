import {
  DEFAULT_GAME_PLAN,
  GamePlan,
  INTERVALS,
  IntervalKey,
  LineupSlot,
  Player,
  PlayerIntervalState,
  SavedGame,
} from '../types/rotation';

export function createId(prefix = 'id'): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getPlayerIntervalState(
  slots: LineupSlot[],
  playerId: string
): PlayerIntervalState {
  for (const slot of slots) {
    if (slot.kind === 'full' && slot.playerId === playerId) {
      return 'full';
    }
    if (slot.kind === 'split') {
      if (slot.firstId === playerId && slot.secondId === playerId) {
        return 'full';
      }
      if (slot.firstId === playerId) return 'first';
      if (slot.secondId === playerId) return 'second';
    }
  }
  return 'bench';
}

export function getPlayerMinutes(
  lineups: Record<IntervalKey, LineupSlot[]>,
  playerId: string
): { halfMinutes: number; fullMinutes: number } {
  let halfMinutes = 0;
  for (const { key } of INTERVALS) {
    const state = getPlayerIntervalState(lineups[key], playerId);
    if (state === 'full') halfMinutes += 4;
    else if (state === 'first' || state === 'second') halfMinutes += 2;
  }
  return {
    halfMinutes,
    fullMinutes: halfMinutes * 2,
  };
}

export interface IntervalSummary {
  firstHalfCount: number;
  secondHalfCount: number;
  isBalanced: boolean;
  openFirstHalfSlot: LineupSlot | null;
  openSecondHalfSlot: LineupSlot | null;
}

export function getIntervalSummary(
  slots: LineupSlot[],
  playersById: Map<string, Player>
): IntervalSummary {
  let firstHalfCount = 0;
  let secondHalfCount = 0;
  let openFirstHalfSlot: LineupSlot | null = null;
  let openSecondHalfSlot: LineupSlot | null = null;

  for (const slot of slots) {
    if (slot.kind === 'full') {
      if (playersById.has(slot.playerId)) {
        firstHalfCount += 1;
        secondHalfCount += 1;
      }
    } else {
      if (slot.firstId && playersById.has(slot.firstId)) {
        firstHalfCount += 1;
      } else if (!slot.firstId && !openFirstHalfSlot) {
        openFirstHalfSlot = slot;
      }

      if (slot.secondId && playersById.has(slot.secondId)) {
        secondHalfCount += 1;
      } else if (!slot.secondId && !openSecondHalfSlot) {
        openSecondHalfSlot = slot;
      }
    }
  }

  return {
    firstHalfCount,
    secondHalfCount,
    isBalanced: firstHalfCount === 5 && secondHalfCount === 5,
    openFirstHalfSlot,
    openSecondHalfSlot,
  };
}

export function removePlayerFromSlots(
  slots: LineupSlot[],
  playerId: string
): LineupSlot[] {
  const next: LineupSlot[] = [];
  for (const slot of slots) {
    if (slot.kind === 'full') {
      if (slot.playerId !== playerId) {
        next.push(slot);
      }
    } else {
      const nextFirst = slot.firstId === playerId ? null : slot.firstId;
      const nextSecond = slot.secondId === playerId ? null : slot.secondId;
      if (nextFirst !== null || nextSecond !== null) {
        next.push({
          ...slot,
          firstId: nextFirst,
          secondId: nextSecond,
        });
      }
    }
  }
  return next;
}

export function setPlayerInInterval(
  slots: LineupSlot[],
  playerId: string,
  targetState: PlayerIntervalState
): LineupSlot[] {
  const cleaned = removePlayerFromSlots(slots, playerId);

  if (targetState === 'bench') {
    return cleaned;
  }

  if (targetState === 'full') {
    return [...cleaned, { id: createId('slot'), kind: 'full', playerId }];
  }

  if (targetState === 'first') {
    const waitingIndex = cleaned.findIndex(
      (s) => s.kind === 'split' && s.firstId === null && s.secondId !== null
    );
    if (waitingIndex !== -1) {
      const target = cleaned[waitingIndex];
      if (target.kind === 'split') {
        const copy = [...cleaned];
        copy[waitingIndex] = { ...target, firstId: playerId };
        return copy;
      }
    }
    return [
      ...cleaned,
      { id: createId('slot'), kind: 'split', firstId: playerId, secondId: null },
    ];
  }

  const waitingIndex = cleaned.findIndex(
    (s) => s.kind === 'split' && s.secondId === null && s.firstId !== null
  );
  if (waitingIndex !== -1) {
    const target = cleaned[waitingIndex];
    if (target.kind === 'split') {
      const copy = [...cleaned];
      copy[waitingIndex] = { ...target, secondId: playerId };
      return copy;
    }
  }
  return [
    ...cleaned,
    { id: createId('slot'), kind: 'split', firstId: null, secondId: playerId },
  ];
}

export function splitSlotWithPlayer(
  slots: LineupSlot[],
  slotId: string,
  partnerId: string | null
): LineupSlot[] {
  const base = partnerId ? removePlayerFromSlots(slots, partnerId) : [...slots];
  return base.map((slot) => {
    if (slot.id !== slotId) return slot;
    if (slot.kind === 'full') {
      return {
        id: slot.id,
        kind: 'split',
        firstId: slot.playerId,
        secondId: partnerId,
      };
    }
    if (slot.firstId === null) {
      return { ...slot, firstId: partnerId };
    }
    return { ...slot, secondId: partnerId };
  });
}

export function swapSplitSlot(
  slots: LineupSlot[],
  slotId: string
): LineupSlot[] {
  return slots.map((slot) => {
    if (slot.id === slotId && slot.kind === 'split') {
      return {
        ...slot,
        firstId: slot.secondId,
        secondId: slot.firstId,
      };
    }
    return slot;
  });
}

export function promoteHalfSlotToFull(
  slots: LineupSlot[],
  slotId: string
): LineupSlot[] {
  return slots.map((slot) => {
    if (slot.id === slotId && slot.kind === 'split') {
      const remaining = slot.firstId ?? slot.secondId;
      if (remaining) {
        return {
          id: slot.id,
          kind: 'full',
          playerId: remaining,
        };
      }
    }
    return slot;
  });
}

export function generateObsidianMarkdown(plan: GamePlan): string {
  const playersById = new Map(plan.players.map((p) => [p.id, p]));
  const activePlayers = plan.players.filter((p) => p.active);

  const playerNames = activePlayers.map((p) => `[[${p.name}]]`).join(', ');

  const lineupLines = INTERVALS.map(({ key }) => {
    const formattedSlots = plan.lineups[key]
      .map((slot) => {
        if (slot.kind === 'full') {
          const p = playersById.get(slot.playerId);
          return p && p.active ? `[[${p.name}]]` : null;
        }
        const p1 = slot.firstId ? playersById.get(slot.firstId) : undefined;
        const p2 = slot.secondId ? playersById.get(slot.secondId) : undefined;
        const n1 = p1 && p1.active ? `[[${p1.name}]]` : null;
        const n2 = p2 && p2.active ? `[[${p2.name}]]` : null;
        if (n1 && n2) return `${n1}/${n2}`;
        if (n1) return n1;
        if (n2) return n2;
        return null;
      })
      .filter((item): item is string => item !== null);

    return `${key}:: ${formattedSlots.join(', ')}`;
  });

  const sections = [
    '---',
    'type: gameplan',
    '---',
    '## Spieler',
    `Spieler:: ${playerNames}`,
    '',
    '## Lineups',
    ...lineupLines,
  ];

  const trimmedNotes = plan.keysNotes?.trim();
  if (trimmedNotes) {
    sections.push('', '## Schlüssel im Spiel', trimmedNotes);
  }

  sections.push(
    '___',
    '```dataviewjs',
    'dv.view("10_Obsidian/20_Views/MinuteTable");',
    '```'
  );

  return sections.join('\n');
}

function extractFieldSegment(text: string, fieldName: string): string | null {
  const knownFields = [
    'Spieler',
    'Zielspieler',
    'Spacer',
    'Screener',
    'Starting',
    'Transition1',
    'Second',
    'Transition2',
    'Finish',
    '___',
    '```dataviewjs',
    '### Filter',
    '## Lineups',
    '## Schlüssel im Spiel',
  ];
  const regex = new RegExp(
    `${fieldName}::\\s*([\\s\\S]*?)(?=(?:${knownFields.join('|')})|$)`,
    'i'
  );
  const match = text.match(regex);
  return match ? match[1].trim() : null;
}

function extractNamesFromWikiList(segment: string): string[] {
  const wikiMatches = [...segment.matchAll(/\[\[([^\]]+)\]\]/g)];
  if (wikiMatches.length > 0) {
    return wikiMatches.map((m) => m[1].trim()).filter(Boolean);
  }
  return segment
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function parseObsidianMarkdown(raw: string): GamePlan {
  const players: Player[] = [];
  const nameToId = new Map<string, string>();

  const ensurePlayer = (name: string): string => {
    const clean = name.trim();
    const key = clean.toLowerCase();
    const existing = nameToId.get(key);
    if (existing) return existing;
    const id = createId('p');
    nameToId.set(key, id);
    players.push({ id, name: clean, active: true });
    return id;
  };

  for (const field of ['Spieler', 'Zielspieler', 'Spacer', 'Screener']) {
    const seg = extractFieldSegment(raw, field);
    if (seg) {
      const names = extractNamesFromWikiList(seg);
      for (const name of names) {
        ensurePlayer(name);
      }
    }
  }

  const lineups: Record<IntervalKey, LineupSlot[]> = {
    Starting: [],
    Transition1: [],
    Second: [],
    Transition2: [],
    Finish: [],
  };

  for (const { key } of INTERVALS) {
    const seg = extractFieldSegment(raw, key);
    if (!seg) continue;
    const tokens = seg
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    for (const token of tokens) {
      if (token.includes('/')) {
        const parts = token.split('/').map((part) => {
          const m = part.match(/\[\[([^\]]+)\]\]/);
          return (m ? m[1] : part).trim();
        });
        if (parts[0] && parts[1]) {
          lineups[key].push({
            id: createId('slot'),
            kind: 'split',
            firstId: ensurePlayer(parts[0]),
            secondId: ensurePlayer(parts[1]),
          });
        } else if (parts[0]) {
          lineups[key].push({
            id: createId('slot'),
            kind: 'full',
            playerId: ensurePlayer(parts[0]),
          });
        }
      } else {
        const m = token.match(/\[\[([^\]]+)\]\]/);
        const clean = (m ? m[1] : token).trim();
        if (clean) {
          lineups[key].push({
            id: createId('slot'),
            kind: 'full',
            playerId: ensurePlayer(clean),
          });
        }
      }
    }
  }

  const notesMatch = raw.match(
    /##\s*Schlüssel im Spiel\s*\n([\s\S]*?)(?=(?:\n___|```dataviewjs|\n##\s)|$)/i
  );
  const keysNotes = notesMatch ? notesMatch[1].trim().slice(0, 4000) : '';

  if (players.length === 0) {
    return keysNotes ? { ...DEFAULT_GAME_PLAN, keysNotes } : DEFAULT_GAME_PLAN;
  }

  return keysNotes ? { players, lineups, keysNotes } : { players, lineups };
}

export function mergeSavedGameAsBasis(
  savedGame: SavedGame,
  currentPlayers: Player[],
  currentClockMode?: GamePlan['clockMode']
): GamePlan {
  const savedById = new Map(savedGame.players.map((p) => [p.id, p]));
  const mergedPlayers: Player[] = savedGame.players.map((p) => ({
    id: p.id,
    name: p.name,
    active: p.active,
  }));

  for (const current of currentPlayers) {
    if (!savedById.has(current.id)) {
      mergedPlayers.push({
        id: current.id,
        name: current.name,
        active: current.active,
      });
    }
  }

  const cloneSlots = (slots: LineupSlot[] = []): LineupSlot[] =>
    slots.map((slot) =>
      slot.kind === 'full'
        ? { id: createId('slot'), kind: 'full', playerId: slot.playerId }
        : {
            id: createId('slot'),
            kind: 'split',
            firstId: slot.firstId,
            secondId: slot.secondId,
          }
    );

  return {
    players: mergedPlayers.slice(0, 40),
    lineups: {
      Starting: cloneSlots(savedGame.lineups.Starting),
      Transition1: cloneSlots(savedGame.lineups.Transition1),
      Second: cloneSlots(savedGame.lineups.Second),
      Transition2: cloneSlots(savedGame.lineups.Transition2),
      Finish: cloneSlots(savedGame.lineups.Finish),
    },
    completedMinutes: [],
    clockMode: currentClockMode ?? 'half',
    keysNotes: savedGame.keysNotes ?? '',
  };
}

export interface SubstitutionEvent {
  minute: number;
  intervalKey: IntervalKey;
  intervalLabel: string;
  isStart: boolean;
  isMidIntervalSplit: boolean;
  playersIn: string[];
  playersOut: string[];
  onCourt: string[];
}

function getSlicePlayerIds(
  slots: LineupSlot[],
  half: 'first' | 'second',
  activeIds: Set<string>
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const slot of slots) {
    const id =
      slot.kind === 'full'
        ? slot.playerId
        : half === 'first'
        ? slot.firstId
        : slot.secondId;
    if (id && activeIds.has(id) && !seen.has(id)) {
      seen.add(id);
      result.push(id);
    }
  }
  return result;
}

export function computeSubstitutionEvents(
  lineups: Record<IntervalKey, LineupSlot[]>,
  players: Player[]
): SubstitutionEvent[] {
  const activeIds = new Set(players.filter((p) => p.active).map((p) => p.id));

  const slices: {
    minute: number;
    intervalKey: IntervalKey;
    intervalLabel: string;
    isMidIntervalSplit: boolean;
    playerIds: string[];
  }[] = [];

  INTERVALS.forEach(({ key, label }, idx) => {
    const baseMinute = idx * 4;
    const slots = lineups[key];
    slices.push({
      minute: baseMinute,
      intervalKey: key,
      intervalLabel: label,
      isMidIntervalSplit: false,
      playerIds: getSlicePlayerIds(slots, 'first', activeIds),
    });
    slices.push({
      minute: baseMinute + 2,
      intervalKey: key,
      intervalLabel: label,
      isMidIntervalSplit: true,
      playerIds: getSlicePlayerIds(slots, 'second', activeIds),
    });
  });

  const events: SubstitutionEvent[] = [];

  for (let i = 0; i < slices.length; i++) {
    const curr = slices[i];
    if (i === 0) {
      events.push({
        minute: curr.minute,
        intervalKey: curr.intervalKey,
        intervalLabel: curr.intervalLabel,
        isStart: true,
        isMidIntervalSplit: false,
        playersIn: curr.playerIds,
        playersOut: [],
        onCourt: curr.playerIds,
      });
      continue;
    }

    const prev = slices[i - 1];
    const prevSet = new Set(prev.playerIds);
    const currSet = new Set(curr.playerIds);

    const playersIn = curr.playerIds.filter((id) => !prevSet.has(id));
    const playersOut = prev.playerIds.filter((id) => !currSet.has(id));

    if (playersIn.length > 0 || playersOut.length > 0) {
      events.push({
        minute: curr.minute,
        intervalKey: curr.intervalKey,
        intervalLabel: curr.intervalLabel,
        isStart: false,
        isMidIntervalSplit: curr.isMidIntervalSplit,
        playersIn,
        playersOut,
        onCourt: curr.playerIds,
      });
    }
  }

  return events;
}

