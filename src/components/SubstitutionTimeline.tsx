import React, { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, Check, RotateCcw } from 'lucide-react';
import { IntervalKey, LineupSlot, Player } from '../types/rotation';
import { computeSubstitutionEvents } from '../utils/rotationLogic';

type ClockDisplayMode = 'half' | 'quarter';

interface SubstitutionTimelineProps {
  players: Player[];
  lineups: Record<IntervalKey, LineupSlot[]>;
  selectedPlayerId: string | null;
  onSelectInterval: (key: IntervalKey) => void;
}

function formatQuarterClock(minute: number): string {
  const isFirstQuarter = minute < 10;
  const qLabel = isFirstQuarter ? 'Q1/Q3' : 'Q2/Q4';
  const remaining = isFirstQuarter ? 10 - minute : 20 - minute;
  return `${qLabel} · ${remaining}:00`;
}

export const SubstitutionTimeline: React.FC<SubstitutionTimelineProps> = ({
  players,
  lineups,
  selectedPlayerId,
  onSelectInterval,
}) => {
  const [clockMode, setClockMode] = useState<ClockDisplayMode>('half');
  const [completedMinutes, setCompletedMinutes] = useState<number[]>([]);

  const playersById = useMemo(
    () => new Map(players.map((p) => [p.id, p])),
    [players]
  );

  const events = useMemo(
    () => computeSubstitutionEvents(lineups, players),
    [lineups, players]
  );

  const toggleCompleted = (minute: number) => {
    setCompletedMinutes((prev) =>
      prev.includes(minute)
        ? prev.filter((m) => m !== minute)
        : [...prev, minute]
    );
  };

  return (
    <section aria-label="Wechselplan nach Zeiten" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-lg font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Wechsel nach Zeiten
          </h2>
          <span className="text-xs text-stone-500 dark:text-stone-400">
            {Math.max(0, events.length - 1)} Wechselzeitpunkte pro Halbzeit
          </span>
        </div>

        <div className="flex items-center gap-2">
          {completedMinutes.length > 0 && (
            <button
              type="button"
              onClick={() => setCompletedMinutes([])}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium border border-stone-200 dark:border-white/[0.1] bg-white dark:bg-[#14171F] text-stone-600 dark:text-stone-300 hover:text-stone-900 dark:hover:text-stone-100 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Abgehakte Wechsel zurücksetzen"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}

          <div
            role="group"
            aria-label="Zeitanzeige"
            className="inline-flex items-center p-0.5 rounded-lg bg-stone-100 dark:bg-white/[0.05] border border-stone-200/80 dark:border-white/[0.06]"
          >
            <button
              type="button"
              onClick={() => setClockMode('half')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                clockMode === 'half'
                  ? 'bg-white dark:bg-[#1E222D] text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              Spielzeit (0&apos;–20&apos;)
            </button>
            <button
              type="button"
              onClick={() => setClockMode('quarter')}
              className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                clockMode === 'quarter'
                  ? 'bg-white dark:bg-[#1E222D] text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
              title="Restzeit auf der Hallenuhr (10:00 → 0:00)"
            >
              Viertel-Uhr
            </button>
          </div>
        </div>
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#14171F] p-6 text-center text-sm text-stone-500 dark:text-stone-400">
          Noch keine Lineups geplant.
        </div>
      ) : (
        <div className="rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#14171F] divide-y divide-stone-100 dark:divide-white/[0.06] overflow-hidden">
          {events.map((ev) => {
            const isDone = completedMinutes.includes(ev.minute);
            const timeLabel =
              clockMode === 'half'
                ? `${ev.minute}'`
                : formatQuarterClock(ev.minute);

            const inNames = ev.playersIn
              .map((id) => playersById.get(id))
              .filter((p): p is Player => Boolean(p));
            const outNames = ev.playersOut
              .map((id) => playersById.get(id))
              .filter((p): p is Player => Boolean(p));
            const onCourtNames = ev.onCourt
              .map((id) => playersById.get(id))
              .filter((p): p is Player => Boolean(p));

            const involvesSelected =
              selectedPlayerId !== null &&
              (ev.playersIn.includes(selectedPlayerId) ||
                ev.playersOut.includes(selectedPlayerId));

            return (
              <div
                key={`${ev.minute}-${ev.intervalKey}`}
                onClick={() => onSelectInterval(ev.intervalKey)}
                className={`px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors cursor-pointer ${
                  isDone
                    ? 'opacity-45 bg-stone-50/50 dark:bg-white/[0.01]'
                    : involvesSelected
                    ? 'bg-red-500/[0.05] dark:bg-red-500/[0.07]'
                    : 'hover:bg-stone-50/70 dark:hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
                  {/* Check button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleCompleted(ev.minute);
                    }}
                    aria-label={
                      isDone
                        ? `Wechsel bei ${timeLabel} als offen markieren`
                        : `Wechsel bei ${timeLabel} abhaken`
                    }
                    className={`mt-0.5 sm:mt-0 w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 transition-colors cursor-pointer ${
                      isDone
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-stone-300 dark:border-white/[0.15] text-transparent hover:border-red-500'
                    }`}
                  >
                    <Check className="w-4 h-4" />
                  </button>

                  {/* Timestamp + Label */}
                  <div className="min-w-[92px] sm:min-w-[116px] shrink-0">
                    <div
                      className={`font-mono text-sm font-semibold tabular-nums whitespace-nowrap ${
                        ev.isStart
                          ? 'text-stone-900 dark:text-stone-100'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {timeLabel}
                    </div>
                    <div className="text-[11px] text-stone-500 dark:text-stone-400 whitespace-nowrap">
                      {ev.intervalLabel}
                      {ev.isMidIntervalSplit ? ' · Split' : ''}
                    </div>
                  </div>

                  {/* In / Out */}
                  <div className="flex-1 min-w-0 space-y-1">
                    {ev.isStart ? (
                      <div className="text-sm text-stone-900 dark:text-stone-100">
                        <span className="text-xs font-medium text-stone-500 dark:text-stone-400 mr-2">
                          Start-5:
                        </span>
                        <span className="font-medium">
                          {onCourtNames.length > 0
                            ? onCourtNames.map((p) => p.name).join(', ')
                            : 'Noch niemand zugewiesen'}
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                        {inNames.length > 0 && (
                          <div className="inline-flex items-center gap-1.5 min-w-0">
                            <ArrowUpRight className="w-4 h-4 text-emerald-500 shrink-0" />
                            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                              Rein:
                            </span>
                            <span className="font-semibold text-stone-900 dark:text-stone-100">
                              {inNames.map((p) => p.name).join(', ')}
                            </span>
                          </div>
                        )}

                        {outNames.length > 0 && (
                          <div className="inline-flex items-center gap-1.5 min-w-0">
                            <ArrowDownLeft className="w-4 h-4 text-rose-500 shrink-0" />
                            <span className="text-xs font-medium text-rose-600 dark:text-rose-400">
                              Raus:
                            </span>
                            <span className="font-medium text-stone-600 dark:text-stone-300">
                              {outNames.map((p) => p.name).join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    )}

                    {!ev.isStart && onCourtNames.length > 0 && (
                      <div className="text-xs text-stone-500 dark:text-stone-400 truncate">
                        Feld ({onCourtNames.length}):{' '}
                        {onCourtNames.map((p) => p.name).join(' · ')}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
