import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, Copy, Plus, Scissors, Trash2, X } from 'lucide-react';
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

interface LineupBoardProps {
  players: Player[];
  lineups: Record<IntervalKey, LineupSlot[]>;
  selectedInterval: IntervalKey;
  selectedPlayerId: string | null;
  onSelectInterval: (key: IntervalKey) => void;
  onSetPlayerIntervalState: (
    playerId: string,
    interval: IntervalKey,
    state: PlayerIntervalState
  ) => void;
  onSplitSlot: (
    interval: IntervalKey,
    slotId: string,
    partnerId: string | null
  ) => void;
  onSwapSplit: (interval: IntervalKey, slotId: string) => void;
  onPromoteHalfToFull: (interval: IntervalKey, slotId: string) => void;
  onClearInterval: (interval: IntervalKey) => void;
  onCopyPrevious: (interval: IntervalKey) => void;
}

export const LineupBoard: React.FC<LineupBoardProps> = ({
  players,
  lineups,
  selectedInterval,
  selectedPlayerId,
  onSelectInterval,
  onSetPlayerIntervalState,
  onSplitSlot,
  onSwapSplit,
  onPromoteHalfToFull,
  onClearInterval,
  onCopyPrevious,
}) => {
  const [splittingTarget, setSplittingTarget] = useState<{
    interval: IntervalKey;
    slotId: string;
  } | null>(null);

  const activePlayers = useMemo(
    () => players.filter((p) => p.active),
    [players]
  );

  const playersById = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players]
  );

  const minutesById = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of activePlayers) {
      map.set(p.id, getPlayerMinutes(lineups, p.id).halfMinutes);
    }
    return map;
  }, [activePlayers, lineups]);

  const getBenchPlayersForInterval = (interval: IntervalKey) => {
    return activePlayers
      .filter(
        (p) => getPlayerIntervalState(lineups[interval], p.id) === 'bench'
      )
      .sort((a, b) => {
        const minA = minutesById.get(a.id) ?? 0;
        const minB = minutesById.get(b.id) ?? 0;
        if (minA !== minB) return minA - minB;
        return a.name.localeCompare(b.name, 'de');
      });
  };

  return (
    <section aria-label="Lineups pro Intervall" className="space-y-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-lg font-bold tracking-tight text-stone-900 dark:text-stone-100">
          Lineups (5er-Formationen)
        </h2>
        <span className="text-xs text-stone-500 dark:text-stone-400">
          Klick auf Schere teilt einen Spot (2&apos; / 2&apos;)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3">
        {INTERVALS.map(({ key, label, range }, index) => {
          const slots = lineups[key];
          const summary = getIntervalSummary(slots, playersById);
          const isSelected = selectedInterval === key;
          const benchPlayers = getBenchPlayersForInterval(key);
          const prevInterval = index > 0 ? INTERVALS[index - 1] : null;
          const hasPrevSlots = prevInterval
            ? lineups[prevInterval.key].length > 0
            : false;
          const countText =
            summary.firstHalfCount === summary.secondHalfCount
              ? `${summary.firstHalfCount}/5`
              : `${summary.firstHalfCount}|${summary.secondHalfCount}/5`;

          return (
            <div
              key={key}
              onClick={() => onSelectInterval(key)}
              className={`rounded-xl border p-3 flex flex-col justify-between gap-3 transition-colors bg-white dark:bg-[#14171F] ${
                isSelected
                  ? 'border-orange-500/60 dark:border-orange-500/50'
                  : 'border-stone-200 dark:border-white/[0.08] hover:border-stone-300 dark:hover:border-white/[0.15]'
              }`}
            >
              {/* Card Header */}
              <div>
                <div className="flex items-center justify-between gap-2 pb-2.5 mb-2.5 border-b border-stone-100 dark:border-white/[0.06]">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-xs font-semibold tabular-nums text-orange-600 dark:text-orange-400">
                        {range}
                      </span>
                      <span className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
                        {label}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span
                      className={`font-mono text-xs tabular-nums ${
                        summary.isBalanced
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400 font-semibold'
                      }`}
                    >
                      {countText}
                    </span>
                    {prevInterval && (
                      <button
                        type="button"
                        disabled={!hasPrevSlots}
                        onClick={(e) => {
                          e.stopPropagation();
                          onCopyPrevious(key);
                        }}
                        title={`Von ${prevInterval.label} übernehmen`}
                        aria-label={`Lineup von ${prevInterval.label} übernehmen`}
                        className="p-1 rounded-md text-stone-400 hover:text-orange-500 hover:bg-stone-100 dark:hover:bg-white/[0.06] disabled:opacity-30 disabled:pointer-events-none transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {slots.length > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onClearInterval(key);
                        }}
                        title={`${label} leeren`}
                        aria-label={`${label} leeren`}
                        className="p-1 rounded-md text-stone-400 hover:text-rose-500 hover:bg-stone-100 dark:hover:bg-white/[0.06] transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Slots */}
                <div className="space-y-1.5">
                  {slots.length === 0 && (
                    <div className="py-3 space-y-2 text-center">
                      <p className="text-xs text-stone-400 dark:text-stone-500">
                        Noch keine Spieler zugewiesen
                      </p>
                      {prevInterval && hasPrevSlots && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onCopyPrevious(key);
                          }}
                          className="w-full py-2 px-2.5 rounded-lg border border-dashed border-stone-300 dark:border-white/[0.12] text-xs font-medium text-stone-600 dark:text-stone-300 hover:border-orange-500/50 hover:text-orange-600 dark:hover:text-orange-400 transition-colors inline-flex items-center justify-center gap-1.5"
                        >
                          <Copy className="w-3.5 h-3.5" />
                          <span>Von {prevInterval.label} übernehmen</span>
                        </button>
                      )}
                    </div>
                  )}

                  {slots.map((slot) => {
                    if (slot.kind === 'full') {
                      const player = playersById.get(slot.playerId);
                      if (!player) return null;
                      const isSplittingThis =
                        splittingTarget?.interval === key &&
                        splittingTarget?.slotId === slot.id;
                      const isHighlighted = selectedPlayerId === player.id;

                      return (
                        <div
                          key={slot.id}
                          className={`rounded-lg px-2.5 py-1.5 border transition-colors ${
                            isHighlighted
                              ? 'border-orange-500/40 bg-orange-500/[0.07]'
                              : 'border-stone-200/80 dark:border-white/[0.06] bg-stone-50/60 dark:bg-white/[0.025]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5 min-h-[30px]">
                            <span className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate">
                              {player.name}
                            </span>

                            <div className="flex items-center gap-0.5 shrink-0">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSplittingTarget(
                                    isSplittingThis
                                      ? null
                                      : { interval: key, slotId: slot.id }
                                  );
                                }}
                                title="Segment teilen (2' / 2')"
                                aria-label={`${player.name} teilen`}
                                className={`p-1.5 rounded-md transition-colors ${
                                  isSplittingThis
                                    ? 'text-orange-500 bg-orange-500/10'
                                    : 'text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-200/60 dark:hover:bg-white/[0.06]'
                                }`}
                              >
                                <Scissors className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSetPlayerIntervalState(
                                    player.id,
                                    key,
                                    'bench'
                                  );
                                }}
                                title="Auf die Bank setzen"
                                aria-label={`${player.name} entfernen`}
                                className="p-1.5 rounded-md text-stone-400 hover:text-rose-500 hover:bg-stone-200/60 dark:hover:bg-white/[0.06] transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {isSplittingThis && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="mt-1.5 pt-1.5 border-t border-stone-200/80 dark:border-white/[0.06]"
                            >
                              <select
                                aria-label="Wechselspieler für 2. Hälfte wählen"
                                defaultValue=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    onSplitSlot(key, slot.id, e.target.value);
                                    setSplittingTarget(null);
                                  }
                                }}
                                className="w-full h-9 rounded-md px-2 text-xs bg-white dark:bg-[#1B1F2A] border border-stone-200 dark:border-white/[0.12] text-stone-800 dark:text-stone-100 focus:outline-2 focus:outline-orange-500"
                              >
                                <option value="" disabled>
                                  2. Hälfte wählen (nach {player.name})…
                                </option>
                                {benchPlayers.map((bp) => (
                                  <option key={bp.id} value={bp.id}>
                                    {bp.name} ({minutesById.get(bp.id) ?? 0}&apos;)
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      );
                    }

                    // Split slot
                    const p1 = slot.firstId
                      ? playersById.get(slot.firstId)
                      : undefined;
                    const p2 = slot.secondId
                      ? playersById.get(slot.secondId)
                      : undefined;
                    const isHighlighted =
                      (p1 && selectedPlayerId === p1.id) ||
                      (p2 && selectedPlayerId === p2.id);

                    return (
                      <div
                        key={slot.id}
                        className={`rounded-lg px-2.5 py-1.5 border transition-colors ${
                          isHighlighted
                            ? 'border-orange-500/40 bg-orange-500/[0.07]'
                            : !p1 || !p2
                            ? 'border-amber-500/40 bg-amber-500/[0.05]'
                            : 'border-orange-500/25 bg-orange-500/[0.03]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1.5 min-h-[30px]">
                          <div className="flex items-center gap-1 min-w-0 text-sm">
                            {p1 ? (
                              <span className="font-medium text-stone-900 dark:text-stone-100 truncate">
                                {p1.name}
                              </span>
                            ) : (
                              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                                1.H?
                              </span>
                            )}
                            <span className="text-stone-400 text-xs">/</span>
                            {p2 ? (
                              <span className="font-medium text-stone-900 dark:text-stone-100 truncate">
                                {p2.name}
                              </span>
                            ) : (
                              <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
                                2.H?
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-0.5 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSwapSplit(key, slot.id);
                              }}
                              title="1. und 2. Hälfte tauschen"
                              aria-label="Hälften tauschen"
                              className="p-1.5 rounded-md text-stone-400 hover:text-orange-500 hover:bg-stone-200/60 dark:hover:bg-white/[0.06] transition-colors"
                            >
                              <ArrowLeftRight className="w-3.5 h-3.5" />
                            </button>
                            {(!p1 || !p2) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onPromoteHalfToFull(key, slot.id);
                                }}
                                title="Auf volle 4 Min erweitern"
                                className="px-1.5 py-1 rounded text-[11px] font-medium text-orange-600 dark:text-orange-400 hover:bg-orange-500/10"
                              >
                                4&apos;
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (p2) {
                                  onSetPlayerIntervalState(p2.id, key, 'bench');
                                } else if (p1) {
                                  onSetPlayerIntervalState(p1.id, key, 'bench');
                                }
                              }}
                              title="Split-Spieler entfernen"
                              aria-label="Split-Spieler entfernen"
                              className="p-1.5 rounded-md text-stone-400 hover:text-rose-500 hover:bg-stone-200/60 dark:hover:bg-white/[0.06] transition-colors"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {(!p1 || !p2) && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1.5 pt-1.5 border-t border-amber-500/20"
                          >
                            <select
                              aria-label="Fehlenden Wechselspieler wählen"
                              defaultValue=""
                              onChange={(e) => {
                                if (e.target.value) {
                                  onSplitSlot(key, slot.id, e.target.value);
                                }
                              }}
                              className="w-full h-9 rounded-md px-2 text-xs bg-white dark:bg-[#1B1F2A] border border-amber-500/30 text-stone-800 dark:text-stone-100 focus:outline-2 focus:outline-orange-500"
                            >
                              <option value="" disabled>
                                {!p1 ? '1. Hälfte wählen…' : '2. Hälfte wählen…'}
                              </option>
                              {benchPlayers.map((bp) => (
                                <option key={bp.id} value={bp.id}>
                                  {bp.name} ({minutesById.get(bp.id) ?? 0}&apos;)
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Add Player */}
              {benchPlayers.length > 0 && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="pt-1"
                >
                  <div className="relative flex items-center">
                    <Plus className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 pointer-events-none" />
                    <select
                      aria-label={`Spieler zu ${label} hinzufügen`}
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          onSetPlayerIntervalState(e.target.value, key, 'full');
                        }
                      }}
                      className="w-full h-9 pl-8 pr-2 rounded-lg text-xs font-medium bg-stone-50 dark:bg-white/[0.03] border border-dashed border-stone-300 dark:border-white/[0.12] text-stone-600 dark:text-stone-300 hover:border-orange-500/50 focus:outline-2 focus:outline-orange-500 cursor-pointer"
                    >
                      <option value="" disabled>
                        Spieler hinzufügen…
                      </option>
                      {benchPlayers.map((bp) => (
                        <option key={bp.id} value={bp.id}>
                          {bp.name} ({minutesById.get(bp.id) ?? 0}&apos;)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
};
