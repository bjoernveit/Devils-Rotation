import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  INTERVALS,
  IntervalKey,
  LineupSlot,
  Player,
  PlayerIntervalState,
} from '../types/rotation';
import {
  getIntervalSummary,
  getPlayerIntervalState,
  getPlayerMinutes,
} from '../utils/rotationLogic';
import { BasketballIcon, BenchIcon } from './Icons';

export type SortMode = 'minutes' | 'name';

interface MinuteTableProps {
  players: Player[];
  lineups: Record<IntervalKey, LineupSlot[]>;
  selectedInterval: IntervalKey;
  selectedPlayerId: string | null;
  onSelectInterval: (key: IntervalKey) => void;
  onSelectPlayer: (playerId: string | null) => void;
  onSetPlayerIntervalState: (
    playerId: string,
    interval: IntervalKey,
    state: PlayerIntervalState
  ) => void;
}

interface ActiveCellPopover {
  playerId: string;
  interval: IntervalKey;
  rect: { top: number; left: number; bottom: number; width: number };
}

export const MinuteTable: React.FC<MinuteTableProps> = ({
  players,
  lineups,
  selectedInterval,
  selectedPlayerId,
  onSelectInterval,
  onSelectPlayer,
  onSetPlayerIntervalState,
}) => {
  const [sortMode, setSortMode] = useState<SortMode>('minutes');
  const [quickToggleMode, setQuickToggleMode] = useState<boolean>(false);
  const [activePopover, setActivePopover] = useState<ActiveCellPopover | null>(
    null
  );
  const popoverRef = useRef<HTMLDivElement>(null);

  const activePlayers = useMemo(
    () => players.filter((p) => p.active),
    [players]
  );

  const playersById = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players]
  );

  const intervalSummaries = useMemo(() => {
    const map = {} as Record<
      IntervalKey,
      ReturnType<typeof getIntervalSummary>
    >;
    for (const { key } of INTERVALS) {
      map[key] = getIntervalSummary(lineups[key], playersById);
    }
    return map;
  }, [lineups, playersById]);

  const sortedPlayers = useMemo(() => {
    return [...activePlayers].sort((a, b) => {
      if (sortMode === 'minutes') {
        const minA = getPlayerMinutes(lineups, a.id).halfMinutes;
        const minB = getPlayerMinutes(lineups, b.id).halfMinutes;
        if (minB !== minA) return minB - minA;
        return a.name.localeCompare(b.name, 'de');
      }
      return a.name.localeCompare(b.name, 'de');
    });
  }, [activePlayers, lineups, sortMode]);

  useEffect(() => {
    if (!activePopover) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setActivePopover(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActivePopover(null);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [activePopover]);

  const handleCellClick = (
    e: React.MouseEvent<HTMLButtonElement>,
    playerId: string,
    interval: IntervalKey,
    currentState: PlayerIntervalState
  ) => {
    onSelectInterval(interval);

    if (quickToggleMode) {
      const nextState: PlayerIntervalState =
        currentState === 'bench' ? 'full' : 'bench';
      onSetPlayerIntervalState(playerId, interval, nextState);
      setActivePopover(null);
      return;
    }

    if (
      activePopover &&
      activePopover.playerId === playerId &&
      activePopover.interval === interval
    ) {
      setActivePopover(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    setActivePopover({
      playerId,
      interval,
      rect: {
        top: rect.top,
        left: rect.left,
        bottom: rect.bottom,
        width: rect.width,
      },
    });
  };

  const renderStateVisual = (state: PlayerIntervalState) => {
    if (state === 'full') {
      return <BasketballIcon size={20} />;
    }
    if (state === 'first') {
      return (
        <span className="inline-flex items-center gap-0.5">
          <BasketballIcon size={17} />
          <BenchIcon size={17} />
        </span>
      );
    }
    if (state === 'second') {
      return (
        <span className="inline-flex items-center gap-0.5">
          <BenchIcon size={17} />
          <BasketballIcon size={17} />
        </span>
      );
    }
    return <BenchIcon size={19} className="opacity-70" />;
  };

  const popoverPlayer = activePopover
    ? playersById.get(activePopover.playerId)
    : null;
  const popoverIntervalMeta = activePopover
    ? INTERVALS.find((i) => i.key === activePopover.interval)
    : null;
  const popoverCurrentState = activePopover
    ? getPlayerIntervalState(
        lineups[activePopover.interval],
        activePopover.playerId
      )
    : 'bench';

  const popoverWaitingInfo = useMemo(() => {
    if (!activePopover) return { firstPartner: null, secondPartner: null };
    const slots = lineups[activePopover.interval];
    let firstPartner: string | null = null;
    let secondPartner: string | null = null;

    for (const s of slots) {
      if (s.kind === 'split') {
        if (s.firstId && !s.secondId && s.firstId !== activePopover.playerId) {
          firstPartner = playersById.get(s.firstId)?.name ?? null;
        }
        if (s.secondId && !s.firstId && s.secondId !== activePopover.playerId) {
          secondPartner = playersById.get(s.secondId)?.name ?? null;
        }
      }
    }
    return { firstPartner, secondPartner };
  }, [activePopover, lineups, playersById]);

  const popoverPositionStyle = useMemo(() => {
    if (!activePopover || typeof window === 'undefined') return undefined;
    const width = 236;
    const height = 232;
    const margin = 12;
    let left = activePopover.rect.left + activePopover.rect.width / 2 - width / 2;
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));

    let top = activePopover.rect.bottom + 6;
    if (top + height > window.innerHeight - margin) {
      top = Math.max(margin, activePopover.rect.top - height - 6);
    }
    return { top, left, width };
  }, [activePopover]);

  return (
    <section
      aria-label="Spielzeit-Matrix"
      className="bg-white dark:bg-[#14171F] border border-stone-200 dark:border-white/[0.08] rounded-xl overflow-hidden"
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-stone-200 dark:border-white/[0.08]">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-lg font-bold tracking-tight text-stone-900 dark:text-stone-100 whitespace-nowrap">
            Minutenplan (1. Halbzeit)
          </h2>
          <span className="hidden sm:inline text-xs text-stone-500 dark:text-stone-400">
            2. Halbzeit identisch
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Quick click vs menu selector */}
          <div
            role="group"
            aria-label="Klick-Verhalten"
            className="inline-flex items-center p-0.5 rounded-lg bg-stone-100 dark:bg-white/[0.05] border border-stone-200/80 dark:border-white/[0.06]"
          >
            <button
              type="button"
              onClick={() => setQuickToggleMode(false)}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                !quickToggleMode
                  ? 'bg-white dark:bg-[#1E222D] text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              Auswahl
            </button>
            <button
              type="button"
              onClick={() => {
                setQuickToggleMode(true);
                setActivePopover(null);
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                quickToggleMode
                  ? 'bg-white dark:bg-[#1E222D] text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
              title="Tippen schaltet direkt zwischen 4 Min und Bank um"
            >
              1-Klick (4&apos;/Bank)
            </button>
          </div>

          {/* Sort selector */}
          <div
            role="group"
            aria-label="Sortierung"
            className="inline-flex items-center p-0.5 rounded-lg bg-stone-100 dark:bg-white/[0.05] border border-stone-200/80 dark:border-white/[0.06]"
          >
            {(
              [
                { id: 'minutes', label: 'Min ↓' },
                { id: 'name', label: 'Name' },
              ] as { id: SortMode; label: string }[]
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSortMode(opt.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                  sortMode === opt.id
                    ? 'bg-white dark:bg-[#1E222D] text-stone-900 dark:text-stone-100 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-stone-200 dark:border-white/[0.08] bg-stone-50/70 dark:bg-white/[0.02]">
              <th
                scope="col"
                className="sticky left-0 z-10 bg-stone-50 dark:bg-[#14171F] py-2.5 pl-3 sm:pl-4 pr-2 text-xs font-semibold text-stone-500 dark:text-stone-400 min-w-[88px] sm:min-w-[128px]"
              >
                Spieler
              </th>
              {INTERVALS.map(({ key, label, range }) => {
                const summary = intervalSummaries[key];
                const isSelected = selectedInterval === key;
                const countLabel =
                  summary.firstHalfCount === summary.secondHalfCount
                    ? `${summary.firstHalfCount}`
                    : `${summary.firstHalfCount}/${summary.secondHalfCount}`;

                return (
                  <th
                    key={key}
                    scope="col"
                    className={`py-2 px-0.5 sm:px-1.5 text-center transition-colors ${
                      isSelected
                        ? 'bg-red-500/[0.08] dark:bg-red-500/[0.1]'
                        : ''
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectInterval(key)}
                      className="w-full min-h-[40px] flex flex-col items-center justify-center rounded-lg px-1 py-1 hover:bg-stone-200/60 dark:hover:bg-white/[0.06] transition-colors focus-visible:outline-2 focus-visible:outline-red-500"
                    >
                      <span
                        className={`font-mono text-xs sm:text-sm font-semibold tabular-nums whitespace-nowrap ${
                          isSelected
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-stone-900 dark:text-stone-100'
                        }`}
                      >
                        {range}
                      </span>
                      <span className="text-[11px] text-stone-500 dark:text-stone-400 whitespace-nowrap hidden sm:inline">
                        {label}
                      </span>
                      <span
                        className={`mt-0.5 font-mono text-[10px] tabular-nums whitespace-nowrap ${
                          summary.isBalanced
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-amber-600 dark:text-amber-400 font-semibold'
                        }`}
                      >
                        {countLabel}/5
                      </span>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-stone-100 dark:divide-white/[0.06]">
            {sortedPlayers.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="py-10 px-4 text-center text-sm text-stone-500 dark:text-stone-400"
                >
                  Keine aktiven Spieler im Kader vorhanden.
                </td>
              </tr>
            ) : (
              sortedPlayers.map((player) => {
                const { halfMinutes, fullMinutes } = getPlayerMinutes(
                  lineups,
                  player.id
                );
                const isRowSelected = selectedPlayerId === player.id;

                return (
                  <tr
                    key={player.id}
                    className={`transition-colors ${
                      isRowSelected
                        ? 'bg-red-500/[0.06] dark:bg-red-500/[0.07]'
                        : 'hover:bg-stone-50/90 dark:hover:bg-white/[0.025]'
                    }`}
                  >
                    <td className="sticky left-0 z-10 bg-white dark:bg-[#14171F] py-1.5 pl-3 sm:pl-4 pr-2 border-r border-stone-100 dark:border-white/[0.04] sm:border-r-0">
                      <button
                        type="button"
                        onClick={() =>
                          onSelectPlayer(isRowSelected ? null : player.id)
                        }
                        className="w-full min-h-[42px] flex flex-col justify-center text-left rounded-md px-1 -mx-1 hover:text-red-600 dark:hover:text-red-400 transition-colors focus-visible:outline-2 focus-visible:outline-red-500"
                      >
                        <span className="font-medium text-sm leading-tight text-stone-900 dark:text-stone-100 truncate">
                          {player.name}
                        </span>
                        <span className="font-mono text-[11px] leading-tight mt-0.5 tabular-nums whitespace-nowrap">
                          <span
                            className={
                              halfMinutes === 0
                                ? 'text-stone-400 dark:text-stone-500'
                                : 'font-semibold text-stone-600 dark:text-stone-300'
                            }
                          >
                            {halfMinutes}
                          </span>{' '}
                          <span className="text-stone-400 dark:text-stone-500">
                            ({fullMinutes})&apos;
                          </span>
                        </span>
                      </button>
                    </td>

                    {INTERVALS.map(({ key }) => {
                      const state = getPlayerIntervalState(
                        lineups[key],
                        player.id
                      );
                      const isColSelected = selectedInterval === key;
                      const isCellEditing =
                        activePopover?.playerId === player.id &&
                        activePopover?.interval === key;

                      return (
                        <td
                          key={key}
                          className={`p-0.5 sm:p-1 text-center ${
                            isColSelected
                              ? 'bg-red-500/[0.04] dark:bg-red-500/[0.05]'
                              : ''
                          }`}
                        >
                          <button
                            type="button"
                            onClick={(e) =>
                              handleCellClick(e, player.id, key, state)
                            }
                            aria-label={`${player.name} in ${key}: ${
                              state === 'full'
                                ? '4 Minuten auf dem Feld'
                                : state === 'first'
                                ? '1. Hälfte 2 Minuten'
                                : state === 'second'
                                ? '2. Hälfte 2 Minuten'
                                : 'Bank'
                            }`}
                            className={`w-full min-w-[42px] min-h-[44px] flex items-center justify-center rounded-lg transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-red-500 ${
                              isCellEditing
                                ? 'ring-2 ring-red-500 bg-red-500/10'
                                : state !== 'bench'
                                ? 'hover:bg-red-500/10 active:scale-95'
                                : 'hover:bg-stone-100 dark:hover:bg-white/[0.06] active:scale-95'
                            }`}
                          >
                            {renderStateVisual(state)}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>

          {/* Summary Row */}
          <tfoot>
            <tr className="border-t border-stone-200 dark:border-white/[0.08] bg-stone-50/80 dark:bg-white/[0.02]">
              <td className="sticky left-0 z-10 bg-stone-50 dark:bg-[#14171F] py-2.5 pl-3 sm:pl-4 pr-2 text-xs font-medium text-stone-500 dark:text-stone-400">
                <span>Auf dem Feld</span>
                <span className="ml-1.5 font-mono text-[11px] tabular-nums text-stone-400 dark:text-stone-500">
                  {activePlayers.reduce(
                    (sum, p) =>
                      sum + getPlayerMinutes(lineups, p.id).halfMinutes,
                    0
                  )}
                  &apos;
                </span>
              </td>
              {INTERVALS.map(({ key }) => {
                const s = intervalSummaries[key];
                const same = s.firstHalfCount === s.secondHalfCount;
                const label = same
                  ? `${s.firstHalfCount}`
                  : `${s.firstHalfCount} | ${s.secondHalfCount}`;
                return (
                  <td
                    key={key}
                    className={`py-2.5 px-1 text-center font-mono text-xs tabular-nums ${
                      s.isBalanced
                        ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                        : 'text-amber-600 dark:text-amber-400 font-semibold'
                    }`}
                  >
                    {label}
                  </td>
                );
              })}
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Legend Footer */}
      <div className="flex flex-wrap items-center justify-end gap-3 px-4 py-2.5 border-t border-stone-200 dark:border-white/[0.08] bg-stone-50/40 dark:bg-white/[0.01] text-xs text-stone-500 dark:text-stone-400">
        <span className="inline-flex items-center gap-1.5">
          <BasketballIcon size={14} /> 4&apos;
        </span>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1">
          <BasketballIcon size={13} />
          <BenchIcon size={13} /> 1. H (2&apos;)
        </span>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1">
          <BenchIcon size={13} />
          <BasketballIcon size={13} /> 2. H (2&apos;)
        </span>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1.5">
          <BenchIcon size={14} /> Bank
        </span>
      </div>

      {/* Floating Cell Popover */}
      {activePopover && popoverPlayer && popoverIntervalMeta && (
        <div
          ref={popoverRef}
          style={popoverPositionStyle}
          role="dialog"
          aria-label={`${popoverPlayer.name} in ${popoverIntervalMeta.label} bearbeiten`}
          className="fixed z-50 rounded-xl bg-white dark:bg-[#1B1F2A] border border-stone-200 dark:border-white/[0.12] shadow-xl p-2"
        >
          <div className="px-2 py-1.5 mb-1 border-b border-stone-100 dark:border-white/[0.06] flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-stone-900 dark:text-stone-100 truncate">
              {popoverPlayer.name}
            </span>
            <span className="font-mono text-[11px] text-stone-500 dark:text-stone-400 shrink-0">
              {popoverIntervalMeta.range} Min
            </span>
          </div>

          <div className="grid grid-cols-1 gap-1">
            <button
              type="button"
              onClick={() => {
                onSetPlayerIntervalState(
                  activePopover.playerId,
                  activePopover.interval,
                  'full'
                );
                setActivePopover(null);
              }}
              className={`min-h-[42px] px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs font-medium transition-colors ${
                popoverCurrentState === 'full'
                  ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                  : 'text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/[0.06]'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <BasketballIcon size={16} />
                <span>Komplett (4 Min)</span>
              </span>
              {popoverCurrentState === 'full' && <span>✓</span>}
            </button>

            <button
              type="button"
              onClick={() => {
                onSetPlayerIntervalState(
                  activePopover.playerId,
                  activePopover.interval,
                  'first'
                );
                setActivePopover(null);
              }}
              className={`min-h-[42px] px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs font-medium transition-colors ${
                popoverCurrentState === 'first'
                  ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                  : 'text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/[0.06]'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex items-center gap-0.5">
                  <BasketballIcon size={14} />
                  <BenchIcon size={14} />
                </span>
                <span className="truncate">
                  1. Hälfte (0–2&apos;)
                  {popoverWaitingInfo.secondPartner
                    ? ` · mit ${popoverWaitingInfo.secondPartner}`
                    : ''}
                </span>
              </span>
              {popoverCurrentState === 'first' && <span>✓</span>}
            </button>

            <button
              type="button"
              onClick={() => {
                onSetPlayerIntervalState(
                  activePopover.playerId,
                  activePopover.interval,
                  'second'
                );
                setActivePopover(null);
              }}
              className={`min-h-[42px] px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs font-medium transition-colors ${
                popoverCurrentState === 'second'
                  ? 'bg-red-500/15 text-red-600 dark:text-red-400'
                  : 'text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/[0.06]'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <span className="inline-flex items-center gap-0.5">
                  <BenchIcon size={14} />
                  <BasketballIcon size={14} />
                </span>
                <span className="truncate">
                  2. Hälfte (2–4&apos;)
                  {popoverWaitingInfo.firstPartner
                    ? ` · mit ${popoverWaitingInfo.firstPartner}`
                    : ''}
                </span>
              </span>
              {popoverCurrentState === 'second' && <span>✓</span>}
            </button>

            <button
              type="button"
              onClick={() => {
                onSetPlayerIntervalState(
                  activePopover.playerId,
                  activePopover.interval,
                  'bench'
                );
                setActivePopover(null);
              }}
              className={`min-h-[42px] px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs font-medium transition-colors ${
                popoverCurrentState === 'bench'
                  ? 'bg-stone-100 dark:bg-white/[0.08] text-stone-900 dark:text-stone-100'
                  : 'text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-white/[0.06]'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <BenchIcon size={16} />
                <span>Bank (0 Min)</span>
              </span>
              {popoverCurrentState === 'bench' && <span>✓</span>}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
