/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  BookmarkPlus,
  Check,
  Copy,
  FileCode2,
  LogOut,
  Moon,
  RotateCcw,
  Sun,
  Trash2,
} from 'lucide-react';
import { AuthScreen } from './components/AuthScreen';
import {
  GameKeysNotes,
  MAX_KEYS_NOTES_LENGTH,
} from './components/GameKeysNotes';
import { LineupBoard } from './components/LineupBoard';
import { MarkdownModal } from './components/MarkdownModal';
import { MinuteTable } from './components/MinuteTable';
import { RosterPanel } from './components/RosterPanel';
import { SavedGamesSection } from './components/SavedGamesSection';
import { SubstitutionTimeline } from './components/SubstitutionTimeline';
import {
  PendingSwapRequest,
  SwapCandidate,
  SwapOutModal,
} from './components/SwapOutModal';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType,
  USERNAME_PATTERN,
} from './firebase';
import {
  ClockDisplayMode,
  DEFAULT_GAME_PLAN,
  GamePlan,
  INTERVALS,
  IntervalKey,
  LineupSlot,
  Player,
  PlayerIntervalState,
  SavedGame,
} from './types/rotation';
import {
  createId,
  generateObsidianMarkdown,
  getIntervalSummary,
  mergeSavedGameAsBasis,
  parseObsidianMarkdown,
  promoteHalfSlotToFull,
  removePlayerFromSlots,
  setPlayerInInterval,
  splitSlotWithPlayer,
  swapSplitSlot,
} from './utils/rotationLogic';

const LEGACY_STORAGE_KEY = 'bb_rotationsplaner_v1';
const THEME_STORAGE_KEY = 'bb_rotationsplaner_theme';

function readLegacyLocalPlan(): GamePlan | null {
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GamePlan>;
    if (parsed && Array.isArray(parsed.players) && parsed.lineups) {
      return {
        players: parsed.players.slice(0, 40).map((p) => ({
          id: p.id,
          name: p.name,
          active: p.active ?? true,
        })),
        lineups: parsed.lineups,
      };
    }
  } catch {
    // Ignore invalid legacy data
  }
  return null;
}

function sanitizeCompletedMinutes(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  const valid = value.filter(
    (n): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 20
  );
  return [...new Set(valid)].sort((a, b) => a - b).slice(0, 20);
}

function sanitizeClockMode(value: unknown): ClockDisplayMode {
  return value === 'quarter' ? 'quarter' : 'half';
}

function sanitizeKeysNotes(value: unknown): string {
  return typeof value === 'string'
    ? value.slice(0, MAX_KEYS_NOTES_LENGTH)
    : '';
}

function toMillis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (
    typeof value === 'object' &&
    value !== null &&
    'toMillis' in value &&
    typeof (value as { toMillis: unknown }).toMillis === 'function'
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  return 0;
}

function sanitizePlanPayload(plan: GamePlan) {
  return {
    players: plan.players.slice(0, 40).map((p) => ({
      id: p.id,
      name: p.name.slice(0, 60),
      active: Boolean(p.active),
    })),
    lineups: {
      Starting: (plan.lineups.Starting || []).slice(0, 15),
      Transition1: (plan.lineups.Transition1 || []).slice(0, 15),
      Second: (plan.lineups.Second || []).slice(0, 15),
      Transition2: (plan.lineups.Transition2 || []).slice(0, 15),
      Finish: (plan.lineups.Finish || []).slice(0, 15),
    },
    completedMinutes: sanitizeCompletedMinutes(plan.completedMinutes),
    clockMode: sanitizeClockMode(plan.clockMode),
    keysNotes: sanitizeKeysNotes(plan.keysNotes),
  };
}

type MobileSection = 'table' | 'subs' | 'lineups' | 'roster' | 'games';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profileUsername, setProfileUsername] = useState<string | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [planLoading, setPlanLoading] = useState(true);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  const [plan, setPlan] = useState<GamePlan>(DEFAULT_GAME_PLAN);
  const planRef = useRef<GamePlan>(DEFAULT_GAME_PLAN);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const pendingWritesRef = useRef<number>(0);
  const planExistsOnServerRef = useRef<boolean>(false);
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [savedGames, setSavedGames] = useState<SavedGame[]>([]);
  const [isSaveGameModalOpen, setIsSaveGameModalOpen] = useState(false);

  const [selectedInterval, setSelectedInterval] =
    useState<IntervalKey>('Starting');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isMarkdownOpen, setIsMarkdownOpen] = useState(false);
  const [pendingSwap, setPendingSwap] = useState<PendingSwapRequest | null>(
    null
  );
  const [copied, setCopied] = useState(false);
  const [mobileSection, setMobileSection] = useState<MobileSection>('table');
  const [isDark, setIsDark] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      return saved ? saved === 'dark' : true;
    } catch {
      return true;
    }
  });

  if (fatalError) {
    throw fatalError;
  }

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem(THEME_STORAGE_KEY, isDark ? 'dark' : 'light');
    } catch {
      // Ignore
    }
  }, [isDark]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        setProfileUsername(null);
        setSavedGames([]);
        planExistsOnServerRef.current = false;
        setPlanLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // Ensure profile + gameplan exist, then subscribe for real-time cross-device sync
  useEffect(() => {
    if (!authReady || !user) return;

    let cancelled = false;
    let unsubPlan: (() => void) | null = null;
    let unsubGames: (() => void) | null = null;
    planExistsOnServerRef.current = false;
    setPlanLoading(true);

    const bootstrapAndSubscribe = async () => {
      const userPath = `users/${user.uid}`;
      const userRef = doc(db, 'users', user.uid);

      try {
        let userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          const fallbackName =
            user.displayName && USERNAME_PATTERN.test(user.displayName)
              ? user.displayName.slice(0, 30)
              : user.email?.split('@')[0]?.slice(0, 30) || 'coach';
          const safeUsername =
            fallbackName.length >= 3 && USERNAME_PATTERN.test(fallbackName)
              ? fallbackName
              : 'coach';

          try {
            await setDoc(userRef, {
              uid: user.uid,
              username: safeUsername,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            if (!cancelled) setProfileUsername(safeUsername);
          } catch (createErr) {
            // If a concurrent request created the profile first, re-read before failing
            userSnap = await getDoc(userRef);
            if (!userSnap.exists()) {
              throw createErr;
            }
          }
        }
        if (userSnap.exists() && !cancelled) {
          const data = userSnap.data();
          if (typeof data.username === 'string') {
            setProfileUsername(data.username);
          }
        }
      } catch (err) {
        if (!cancelled) {
          try {
            handleFirestoreError(err, OperationType.WRITE, userPath);
          } catch (wrapped) {
            setFatalError(wrapped as Error);
          }
        }
        return;
      }

      if (cancelled) return;

      const planPath = `users/${user.uid}/plans/default`;
      const planRefDoc = doc(db, 'users', user.uid, 'plans', 'default');

      try {
        const initialSnap = await getDoc(planRefDoc);
        if (cancelled) return;

        if (!initialSnap.exists()) {
          const legacy = readLegacyLocalPlan();
          const initial = legacy ?? DEFAULT_GAME_PLAN;
          const payload = sanitizePlanPayload(initial);
          await setDoc(planRefDoc, {
            ownerId: user.uid,
            ...payload,
            updatedAt: serverTimestamp(),
          });
          planExistsOnServerRef.current = true;
          if (legacy) {
            try {
              localStorage.removeItem(LEGACY_STORAGE_KEY);
            } catch {
              // Ignore
            }
          }
          if (!cancelled) {
            planRef.current = payload;
            setPlan(payload);
            setPlanLoading(false);
          }
        } else {
          const data = initialSnap.data();
          const loaded: GamePlan = {
            players: Array.isArray(data.players) ? data.players : [],
            lineups: data.lineups ?? DEFAULT_GAME_PLAN.lineups,
            completedMinutes: sanitizeCompletedMinutes(data.completedMinutes),
            clockMode: sanitizeClockMode(data.clockMode),
            keysNotes: sanitizeKeysNotes(data.keysNotes),
          };
          planExistsOnServerRef.current = true;
          if (!cancelled) {
            planRef.current = loaded;
            setPlan(loaded);
            setPlanLoading(false);
          }
        }
      } catch (err) {
        if (!cancelled) {
          try {
            handleFirestoreError(err, OperationType.CREATE, planPath);
          } catch (wrapped) {
            setFatalError(wrapped as Error);
          }
        }
        return;
      }

      if (cancelled) return;

      unsubPlan = onSnapshot(
        planRefDoc,
        (snapshot) => {
          if (cancelled) return;
          if (
            snapshot.metadata.hasPendingWrites ||
            pendingWritesRef.current > 0
          ) {
            return;
          }
          if (!snapshot.exists()) return;

          const data = snapshot.data();
          const loaded: GamePlan = {
            players: Array.isArray(data.players) ? data.players : [],
            lineups: data.lineups ?? DEFAULT_GAME_PLAN.lineups,
            completedMinutes: sanitizeCompletedMinutes(data.completedMinutes),
            clockMode: sanitizeClockMode(data.clockMode),
            keysNotes: sanitizeKeysNotes(data.keysNotes),
          };
          planExistsOnServerRef.current = true;
          planRef.current = loaded;
          setPlan(loaded);
          setPlanLoading(false);
        },
        (error) => {
          if (cancelled) return;
          try {
            handleFirestoreError(error, OperationType.GET, planPath);
          } catch (wrapped) {
            setFatalError(wrapped as Error);
          }
        }
      );

      const gamesPath = `users/${user.uid}/games`;
      const gamesQuery = query(
        collection(db, 'users', user.uid, 'games'),
        where('ownerId', '==', user.uid)
      );
      unsubGames = onSnapshot(
        gamesQuery,
        (snapshot) => {
          if (cancelled) return;
          const items: SavedGame[] = snapshot.docs.map((docSnap) => {
            const d = docSnap.data();
            return {
              id: docSnap.id,
              title: typeof d.title === 'string' ? d.title : 'Spiel',
              gameDate: typeof d.gameDate === 'string' ? d.gameDate : '',
              players: Array.isArray(d.players) ? d.players : [],
              lineups: d.lineups ?? DEFAULT_GAME_PLAN.lineups,
              keysNotes: sanitizeKeysNotes(d.keysNotes),
              createdAtMs: toMillis(d.createdAt),
              updatedAtMs: toMillis(d.updatedAt),
            };
          });
          items.sort((a, b) => b.updatedAtMs - a.updatedAtMs);
          setSavedGames(items);
        },
        (error) => {
          if (cancelled) return;
          try {
            handleFirestoreError(error, OperationType.LIST, gamesPath);
          } catch (wrapped) {
            setFatalError(wrapped as Error);
          }
        }
      );
    };

    void bootstrapAndSubscribe();

    return () => {
      cancelled = true;
      if (notesTimerRef.current) {
        clearTimeout(notesTimerRef.current);
        notesTimerRef.current = null;
      }
      if (unsubPlan) unsubPlan();
      if (unsubGames) unsubGames();
    };
  }, [authReady, user]);

  const persistPlanToFirestore = (uid: string, nextPlan: GamePlan) => {
    const planPath = `users/${uid}/plans/default`;
    const planDocRef = doc(db, 'users', uid, 'plans', 'default');
    const payload = sanitizePlanPayload(nextPlan);

    pendingWritesRef.current += 1;
    writeQueueRef.current = writeQueueRef.current
      .then(async () => {
        try {
          if (planExistsOnServerRef.current) {
            try {
              await updateDoc(planDocRef, {
                ...payload,
                updatedAt: serverTimestamp(),
              });
            } catch (err) {
              const code =
                typeof err === 'object' && err !== null && 'code' in err
                  ? String((err as { code: unknown }).code)
                  : '';
              if (code === 'not-found') {
                await setDoc(planDocRef, {
                  ownerId: uid,
                  ...payload,
                  updatedAt: serverTimestamp(),
                });
                planExistsOnServerRef.current = true;
              } else {
                throw err;
              }
            }
          } else {
            await setDoc(planDocRef, {
              ownerId: uid,
              ...payload,
              updatedAt: serverTimestamp(),
            });
            planExistsOnServerRef.current = true;
          }
        } catch (err) {
          try {
            handleFirestoreError(err, OperationType.UPDATE, planPath);
          } catch (wrapped) {
            setFatalError(wrapped as Error);
          }
        } finally {
          pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
        }
      })
      .catch(() => {
        pendingWritesRef.current = Math.max(0, pendingWritesRef.current - 1);
      });
  };

  const commitPlan = (updater: (prev: GamePlan) => GamePlan) => {
    const next = updater(planRef.current);
    planRef.current = next;
    setPlan(next);
    if (user) {
      persistPlanToFirestore(user.uid, next);
    }
  };

  const markdownOutput = useMemo(() => generateObsidianMarkdown(plan), [plan]);

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdownOutput);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setIsMarkdownOpen(true);
    }
  };

  const handleSetPlayerIntervalState = (
    playerId: string,
    interval: IntervalKey,
    state: PlayerIntervalState
  ) => {
    if (state !== 'bench') {
      const playersById = new Map(
        planRef.current.players.map((p) => [p.id, p])
      );
      const currentSlots = planRef.current.lineups[interval];
      const nextSlots = setPlayerInInterval(currentSlots, playerId, state);
      const nextSummary = getIntervalSummary(nextSlots, playersById);

      if (nextSummary.firstHalfCount > 5 || nextSummary.secondHalfCount > 5) {
        const mode =
          nextSummary.firstHalfCount > 5 && nextSummary.secondHalfCount > 5
            ? 'full'
            : nextSummary.firstHalfCount > 5
            ? 'first'
            : 'second';
        setPendingSwap({
          playerId,
          interval,
          targetState: state,
          mode,
        });
        return;
      }
    }

    commitPlan((prev) => ({
      ...prev,
      lineups: {
        ...prev.lineups,
        [interval]: setPlayerInInterval(prev.lineups[interval], playerId, state),
      },
    }));
  };

  const handleConfirmSwapOut = (candidate: SwapCandidate) => {
    if (!pendingSwap) return;
    const { playerId, interval, targetState, mode } = pendingSwap;

    commitPlan((prev) => {
      const currentSlots = prev.lineups[interval];
      const incomingWasInSplit = currentSlots.find(
        (s) =>
          s.kind === 'split' &&
          (s.firstId === playerId || s.secondId === playerId)
      );

      if (
        targetState === 'full' &&
        mode !== 'full' &&
        incomingWasInSplit &&
        incomingWasInSplit.id !== candidate.slotId
      ) {
        const replacedSlot = currentSlots.find(
          (s) => s.id === candidate.slotId
        );
        const vacatedHalfPlayer =
          replacedSlot?.kind === 'full'
            ? replacedSlot.playerId
            : mode === 'first'
            ? replacedSlot?.kind === 'split'
              ? replacedSlot.firstId
              : null
            : replacedSlot?.kind === 'split'
            ? replacedSlot.secondId
            : null;

        const nextSlots: LineupSlot[] = [];
        for (const slot of currentSlots) {
          if (slot.id === incomingWasInSplit.id && slot.kind === 'split') {
            const nextFirst =
              slot.firstId === playerId ? vacatedHalfPlayer : slot.firstId;
            const nextSecond =
              slot.secondId === playerId ? vacatedHalfPlayer : slot.secondId;
            if (nextFirst || nextSecond) {
              nextSlots.push({
                ...slot,
                firstId: nextFirst,
                secondId: nextSecond,
              });
            }
            continue;
          }

          if (slot.id === candidate.slotId) {
            if (slot.kind === 'full') {
              nextSlots.push({
                id: slot.id,
                kind: 'full',
                playerId,
              });
            } else {
              const remainingFirst = mode === 'first' ? null : slot.firstId;
              const remainingSecond = mode === 'second' ? null : slot.secondId;
              if (remainingFirst || remainingSecond) {
                nextSlots.push({
                  ...slot,
                  firstId: remainingFirst,
                  secondId: remainingSecond,
                });
              }
              nextSlots.push({
                id: createId('slot'),
                kind: 'full',
                playerId,
              });
            }
            continue;
          }

          nextSlots.push(slot);
        }

        return {
          ...prev,
          lineups: {
            ...prev.lineups,
            [interval]: nextSlots,
          },
        };
      }

      const withoutIncoming = removePlayerFromSlots(currentSlots, playerId);
      const nextSlots: LineupSlot[] = [];
      let deferredKeepHalf: {
        playerId: string;
        half: 'first' | 'second';
      } | null = null;

      for (const slot of withoutIncoming) {
        if (slot.id !== candidate.slotId) {
          nextSlots.push(slot);
          continue;
        }

        if (targetState === 'full') {
          if (mode === 'full') {
            nextSlots.push({
              id: slot.id,
              kind: 'full',
              playerId,
            });
          } else if (
            incomingWasInSplit &&
            incomingWasInSplit.id === slot.id
          ) {
            nextSlots.push({
              id: slot.id,
              kind: 'full',
              playerId,
            });
          } else if (slot.kind === 'full') {
            nextSlots.push({
              id: slot.id,
              kind: 'full',
              playerId,
            });
            deferredKeepHalf = {
              playerId: slot.playerId,
              half: mode === 'second' ? 'first' : 'second',
            };
          } else if (slot.kind === 'split') {
            const nextFirst = mode === 'first' ? null : slot.firstId;
            const nextSecond = mode === 'second' ? null : slot.secondId;
            if (nextFirst || nextSecond) {
              nextSlots.push({
                ...slot,
                firstId: nextFirst,
                secondId: nextSecond,
              });
            }
            nextSlots.push({
              id: createId('slot'),
              kind: 'full',
              playerId,
            });
          }
        } else if (targetState === 'first') {
          if (slot.kind === 'full') {
            nextSlots.push({
              id: slot.id,
              kind: 'split',
              firstId: playerId,
              secondId: slot.playerId,
            });
          } else {
            nextSlots.push({
              ...slot,
              firstId: playerId,
            });
          }
        } else if (targetState === 'second') {
          if (slot.kind === 'full') {
            nextSlots.push({
              id: slot.id,
              kind: 'split',
              firstId: slot.playerId,
              secondId: playerId,
            });
          } else {
            nextSlots.push({
              ...slot,
              secondId: playerId,
            });
          }
        }
      }

      const finalSlots = deferredKeepHalf
        ? setPlayerInInterval(
            nextSlots,
            deferredKeepHalf.playerId,
            deferredKeepHalf.half
          )
        : nextSlots;

      return {
        ...prev,
        lineups: {
          ...prev.lineups,
          [interval]: finalSlots,
        },
      };
    });

    setPendingSwap(null);
  };

  const handleSplitSlot = (
    interval: IntervalKey,
    slotId: string,
    partnerId: string | null
  ) => {
    commitPlan((prev) => ({
      ...prev,
      lineups: {
        ...prev.lineups,
        [interval]: splitSlotWithPlayer(
          prev.lineups[interval],
          slotId,
          partnerId
        ),
      },
    }));
  };

  const handleSwapSplit = (interval: IntervalKey, slotId: string) => {
    commitPlan((prev) => ({
      ...prev,
      lineups: {
        ...prev.lineups,
        [interval]: swapSplitSlot(prev.lineups[interval], slotId),
      },
    }));
  };

  const handlePromoteHalfToFull = (interval: IntervalKey, slotId: string) => {
    commitPlan((prev) => ({
      ...prev,
      lineups: {
        ...prev.lineups,
        [interval]: promoteHalfSlotToFull(prev.lineups[interval], slotId),
      },
    }));
  };

  const handleClearInterval = (interval: IntervalKey) => {
    commitPlan((prev) => ({
      ...prev,
      lineups: {
        ...prev.lineups,
        [interval]: [],
      },
    }));
  };

  const handleCopyPreviousInterval = (interval: IntervalKey) => {
    const idx = INTERVALS.findIndex((item) => item.key === interval);
    if (idx <= 0) return;
    const prevKey = INTERVALS[idx - 1].key;

    commitPlan((prev) => ({
      ...prev,
      lineups: {
        ...prev.lineups,
        [interval]: prev.lineups[prevKey].map((slot) => ({
          ...slot,
          id: createId('slot'),
        })),
      },
    }));
  };

  const handleClearAllLineups = () => {
    commitPlan((prev) => ({
      ...prev,
      lineups: {
        Starting: [],
        Transition1: [],
        Second: [],
        Transition2: [],
        Finish: [],
      },
    }));
  };

  const handleResetDemo = () => {
    commitPlan(() => DEFAULT_GAME_PLAN);
    setSelectedPlayerId(null);
  };

  const handleAddPlayer = (name: string) => {
    if (planRef.current.players.length >= 40) return;
    const newPlayer: Player = {
      id: createId('p'),
      name: name.slice(0, 60),
      active: true,
    };
    commitPlan((prev) => ({
      ...prev,
      players: [...prev.players, newPlayer],
    }));
  };

  const handleUpdatePlayer = (playerId: string, patch: Partial<Player>) => {
    commitPlan((prev) => {
      const nextPlayers = prev.players.map((p) =>
        p.id === playerId ? { ...p, ...patch } : p
      );

      if (patch.active === false) {
        return {
          ...prev,
          players: nextPlayers,
          lineups: {
            Starting: removePlayerFromSlots(prev.lineups.Starting, playerId),
            Transition1: removePlayerFromSlots(
              prev.lineups.Transition1,
              playerId
            ),
            Second: removePlayerFromSlots(prev.lineups.Second, playerId),
            Transition2: removePlayerFromSlots(
              prev.lineups.Transition2,
              playerId
            ),
            Finish: removePlayerFromSlots(prev.lineups.Finish, playerId),
          },
        };
      }

      return {
        ...prev,
        players: nextPlayers,
      };
    });
  };

  const handleDeletePlayer = (playerId: string) => {
    commitPlan((prev) => ({
      ...prev,
      players: prev.players.filter((p) => p.id !== playerId),
      lineups: {
        Starting: removePlayerFromSlots(prev.lineups.Starting, playerId),
        Transition1: removePlayerFromSlots(prev.lineups.Transition1, playerId),
        Second: removePlayerFromSlots(prev.lineups.Second, playerId),
        Transition2: removePlayerFromSlots(prev.lineups.Transition2, playerId),
        Finish: removePlayerFromSlots(prev.lineups.Finish, playerId),
      },
    }));
    if (selectedPlayerId === playerId) {
      setSelectedPlayerId(null);
    }
  };

  const handleImportMarkdown = (raw: string) => {
    const imported = parseObsidianMarkdown(raw);
    commitPlan(() => imported);
    setSelectedPlayerId(null);
  };

  const handleClockModeChange = (mode: ClockDisplayMode) => {
    commitPlan((prev) => ({
      ...prev,
      clockMode: mode,
    }));
  };

  const handleToggleCompletedMinute = (minute: number) => {
    commitPlan((prev) => {
      const current = prev.completedMinutes ?? [];
      const nextMinutes = current.includes(minute)
        ? current.filter((m) => m !== minute)
        : [...current, minute].sort((a, b) => a - b);
      return {
        ...prev,
        completedMinutes: nextMinutes,
      };
    });
  };

  const handleResetCompletedMinutes = () => {
    commitPlan((prev) => ({
      ...prev,
      completedMinutes: [],
    }));
  };

  const handleKeysNotesChange = (nextNotes: string) => {
    const clean = nextNotes.slice(0, MAX_KEYS_NOTES_LENGTH);
    const nextPlan: GamePlan = {
      ...planRef.current,
      keysNotes: clean,
    };
    planRef.current = nextPlan;
    setPlan(nextPlan);

    if (notesTimerRef.current) {
      clearTimeout(notesTimerRef.current);
    }
    if (user) {
      const uid = user.uid;
      notesTimerRef.current = setTimeout(() => {
        notesTimerRef.current = null;
        persistPlanToFirestore(uid, planRef.current);
      }, 350);
    }
  };

  const handleKeysNotesFlush = () => {
    if (notesTimerRef.current) {
      clearTimeout(notesTimerRef.current);
      notesTimerRef.current = null;
      if (user) {
        persistPlanToFirestore(user.uid, planRef.current);
      }
    }
  };

  const handleSaveNewGame = async ({
    title,
    gameDate,
    keysNotes,
  }: {
    title: string;
    gameDate: string;
    keysNotes: string;
  }) => {
    if (!user) return;
    const gameId = `g-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const gamePath = `users/${user.uid}/games/${gameId}`;
    const payload = sanitizePlanPayload(planRef.current);

    if (keysNotes !== (planRef.current.keysNotes ?? '')) {
      handleKeysNotesChange(keysNotes);
      handleKeysNotesFlush();
    }

    try {
      await setDoc(doc(db, 'users', user.uid, 'games', gameId), {
        ownerId: user.uid,
        title: title.trim().slice(0, 80),
        gameDate: gameDate.trim().slice(0, 20),
        players: payload.players,
        lineups: payload.lineups,
        keysNotes: sanitizeKeysNotes(keysNotes),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.CREATE, gamePath);
      } catch (wrapped) {
        setFatalError(wrapped as Error);
      }
    }
  };

  const handleUpdateSavedGameWithCurrent = async (game: SavedGame) => {
    if (!user) return;
    const gamePath = `users/${user.uid}/games/${game.id}`;
    const payload = sanitizePlanPayload(planRef.current);
    try {
      await updateDoc(doc(db, 'users', user.uid, 'games', game.id), {
        players: payload.players,
        lineups: payload.lineups,
        keysNotes: payload.keysNotes,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.UPDATE, gamePath);
      } catch (wrapped) {
        setFatalError(wrapped as Error);
      }
    }
  };

  const handleDeleteGame = async (gameId: string) => {
    if (!user) return;
    const gamePath = `users/${user.uid}/games/${gameId}`;
    try {
      await deleteDoc(doc(db, 'users', user.uid, 'games', gameId));
    } catch (err) {
      try {
        handleFirestoreError(err, OperationType.DELETE, gamePath);
      } catch (wrapped) {
        setFatalError(wrapped as Error);
      }
    }
  };

  const handleLoadGameAsBasis = (game: SavedGame) => {
    if (notesTimerRef.current) {
      clearTimeout(notesTimerRef.current);
      notesTimerRef.current = null;
    }
    commitPlan((prev) => mergeSavedGameAsBasis(game, prev.players, prev.clockMode));
    setSelectedPlayerId(null);
    setMobileSection('table');
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setSelectedPlayerId(null);
  };

  if (!authReady || (user && planLoading)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50 dark:bg-[#0D0F14] text-stone-500 dark:text-stone-400 text-sm">
        Lade Rotationsplaner…
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  const displayUsername =
    profileUsername || user.displayName || user.email?.split('@')[0] || 'Coach';

  return (
    <div className="min-h-screen flex flex-col bg-stone-50 dark:bg-[#0D0F14] text-stone-900 dark:text-stone-100">
      {/* Sticky Top Bar (3-zone contract) */}
      <header className="sticky top-0 z-30 border-b border-stone-200 dark:border-white/[0.08] bg-white/90 dark:bg-[#0D0F14]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          {/* Zone 1: Brand wordmark */}
          <a
            href="#top"
            className="font-display text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100 whitespace-nowrap shrink-0"
          >
            Rotationsplaner
          </a>

          {/* Zone 2: Clean single-line nav links */}
          <nav
            aria-label="Bereiche"
            className="hidden md:flex items-center gap-6 text-sm font-medium text-stone-600 dark:text-stone-400"
          >
            <a
              href="#minutenplan"
              className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors whitespace-nowrap shrink-0"
            >
              Minutenplan
            </a>
            <a
              href="#wechsel"
              className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors whitespace-nowrap shrink-0"
            >
              Wechsel
            </a>
            <a
              href="#lineups"
              className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors whitespace-nowrap shrink-0"
            >
              Lineups
            </a>
            <a
              href="#kader"
              className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors whitespace-nowrap shrink-0"
            >
              Kader
            </a>
            <a
              href="#spiele"
              className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors whitespace-nowrap shrink-0"
            >
              Spiele
            </a>
            <button
              type="button"
              onClick={() => setIsMarkdownOpen(true)}
              className="hover:text-stone-900 dark:hover:text-stone-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Markdown
            </button>
          </nav>

          {/* Zone 3: Primary CTA */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleCopyMarkdown}
              className="px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white inline-flex items-center gap-2 transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Kopiert</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>MD kopieren</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Workspace Utility Strip (below top bar) */}
      <div
        id="top"
        className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4 pb-2 flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-500 dark:text-stone-400">
          <span className="font-medium text-stone-700 dark:text-stone-200">
            {displayUsername}
          </span>
          <span aria-hidden="true">·</span>
          <span>Halbzeit 20 Min (5 × 4 Min)</span>
          <span aria-hidden="true" className="hidden sm:inline">
            ·
          </span>
          <span className="hidden sm:inline">Gesamtspiel = 2× Halbzeit</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setIsSaveGameModalOpen(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-red-600/30 bg-red-600/10 hover:bg-red-600/20 text-red-700 dark:text-red-400 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            title="Aktuelles Lineup für ein Spiel speichern"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span>Spiel speichern</span>
          </button>

          <button
            type="button"
            onClick={() => setIsMarkdownOpen(true)}
            className="md:hidden px-3 py-1.5 rounded-lg text-xs font-medium border border-stone-200 dark:border-white/[0.1] bg-white dark:bg-[#14171F] text-stone-700 dark:text-stone-200 inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>MD / Import</span>
          </button>

          <button
            type="button"
            onClick={handleClearAllLineups}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-stone-200 dark:border-white/[0.1] bg-white dark:bg-[#14171F] text-stone-600 dark:text-stone-300 hover:text-rose-600 dark:hover:text-rose-400 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            title="Alle 5 Lineups leeren (Kader behalten)"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Lineups leeren</span>
          </button>

          <button
            type="button"
            onClick={handleResetDemo}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-stone-200 dark:border-white/[0.1] bg-white dark:bg-[#14171F] text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            title="Beispiel-Spieltag wiederherstellen"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Beispiel</span>
          </button>

          <button
            type="button"
            onClick={() => setIsDark((d) => !d)}
            aria-label={
              isDark ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren'
            }
            className="p-1.5 rounded-lg border border-stone-200 dark:border-white/[0.1] bg-white dark:bg-[#14171F] text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 transition-colors cursor-pointer"
          >
            {isDark ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Abmelden"
            title="Abmelden"
            className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-stone-200 dark:border-white/[0.1] bg-white dark:bg-[#14171F] text-stone-600 dark:text-stone-300 hover:text-rose-600 dark:hover:text-rose-400 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Abmelden</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 pb-24 lg:pb-10 flex-1 space-y-6">
        {/* Desktop 2-column layout (Table + Roster/Notes), LineupBoard full-width below */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div
            id="minutenplan"
            className={`lg:col-span-8 xl:col-span-9 ${
              mobileSection === 'table' ? 'block' : 'hidden lg:block'
            }`}
          >
            <MinuteTable
              players={plan.players}
              lineups={plan.lineups}
              selectedInterval={selectedInterval}
              selectedPlayerId={selectedPlayerId}
              onSelectInterval={setSelectedInterval}
              onSelectPlayer={setSelectedPlayerId}
              onSetPlayerIntervalState={handleSetPlayerIntervalState}
            />
          </div>

          <div
            id="kader"
            className={`lg:col-span-4 xl:col-span-3 space-y-6 ${
              mobileSection === 'roster' ? 'block' : 'hidden lg:block'
            }`}
          >
            <RosterPanel
              players={plan.players}
              lineups={plan.lineups}
              selectedPlayerId={selectedPlayerId}
              onSelectPlayer={setSelectedPlayerId}
              onAddPlayer={handleAddPlayer}
              onUpdatePlayer={handleUpdatePlayer}
              onDeletePlayer={handleDeletePlayer}
            />

            <div className="hidden lg:block">
              <GameKeysNotes
                value={plan.keysNotes ?? ''}
                onChange={handleKeysNotesChange}
                onBlur={handleKeysNotesFlush}
              />
            </div>
          </div>
        </div>

        {/* 5-Interval Lineup Board */}
        <div
          id="lineups"
          className={`space-y-6 ${
            mobileSection === 'lineups' ? 'block' : 'hidden lg:block'
          }`}
        >
          <LineupBoard
            players={plan.players}
            lineups={plan.lineups}
            selectedInterval={selectedInterval}
            selectedPlayerId={selectedPlayerId}
            onSelectInterval={setSelectedInterval}
            onSetPlayerIntervalState={handleSetPlayerIntervalState}
            onSplitSlot={handleSplitSlot}
            onSwapSplit={handleSwapSplit}
            onPromoteHalfToFull={handlePromoteHalfToFull}
            onClearInterval={handleClearInterval}
            onCopyPrevious={handleCopyPreviousInterval}
          />

          <div className="lg:hidden">
            <GameKeysNotes
              value={plan.keysNotes ?? ''}
              onChange={handleKeysNotesChange}
              onBlur={handleKeysNotesFlush}
            />
          </div>
        </div>

        {/* Chronological Substitution View */}
        <div
          id="wechsel"
          className={mobileSection === 'subs' ? 'block' : 'hidden lg:block'}
        >
          <SubstitutionTimeline
            players={plan.players}
            lineups={plan.lineups}
            selectedPlayerId={selectedPlayerId}
            clockMode={plan.clockMode ?? 'half'}
            completedMinutes={plan.completedMinutes ?? []}
            onSelectInterval={setSelectedInterval}
            onClockModeChange={handleClockModeChange}
            onToggleCompletedMinute={handleToggleCompletedMinute}
            onResetCompletedMinutes={handleResetCompletedMinutes}
          />
        </div>

        {/* Saved Games */}
        <div
          id="spiele"
          className={mobileSection === 'games' ? 'block' : 'hidden lg:block'}
        >
          <SavedGamesSection
            savedGames={savedGames}
            currentKeysNotes={plan.keysNotes ?? ''}
            saveModalOpen={isSaveGameModalOpen}
            onOpenSaveModal={() => setIsSaveGameModalOpen(true)}
            onCloseSaveModal={() => setIsSaveGameModalOpen(false)}
            onSaveNewGame={handleSaveNewGame}
            onUpdateSavedGameWithCurrent={handleUpdateSavedGameWithCurrent}
            onLoadAsBasis={handleLoadGameAsBasis}
            onDeleteGame={handleDeleteGame}
          />
        </div>
      </main>

      {/* Mobile Bottom Tab Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-14 bg-white/95 dark:bg-[#14171F]/95 backdrop-blur-md border-t border-stone-200 dark:border-white/[0.08] grid grid-cols-5"
      >
        {(
          [
            { id: 'table', label: 'Minuten' },
            { id: 'subs', label: 'Wechsel' },
            { id: 'lineups', label: 'Lineups' },
            { id: 'roster', label: 'Kader' },
            { id: 'games', label: 'Spiele' },
          ] as { id: MobileSection; label: string }[]
        ).map((tab) => {
          const active = mobileSection === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMobileSection(tab.id)}
              className={`flex items-center justify-center text-xs font-semibold transition-colors whitespace-nowrap ${
                active
                  ? 'text-red-600 dark:text-red-400 border-t-2 border-red-600 dark:border-red-500 -mt-[1px]'
                  : 'text-stone-500 dark:text-stone-400'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      {/* Obsidian Markdown Preview / Import Modal */}
      <MarkdownModal
        isOpen={isMarkdownOpen}
        markdown={markdownOutput}
        onClose={() => setIsMarkdownOpen(false)}
        onImport={handleImportMarkdown}
        onCopy={handleCopyMarkdown}
        copied={copied}
      />

      {/* Ask who goes out when adding a 6th player */}
      <SwapOutModal
        request={pendingSwap}
        players={plan.players}
        lineups={plan.lineups}
        onConfirm={handleConfirmSwapOut}
        onCancel={() => setPendingSwap(null)}
      />
    </div>
  );
}
