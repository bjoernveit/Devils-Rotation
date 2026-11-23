import React, { useEffect } from 'react';
import { ArrowLeftRight, X } from 'lucide-react';
import {
  INTERVALS,
  IntervalKey,
  LineupSlot,
  Player,
} from '../types/rotation';
import { getPlayerMinutes } from '../utils/rotationLogic';

export type SwapMode = 'full' | 'first' | 'second';

export interface PendingSwapRequest {
  playerId: string;
  interval: IntervalKey;
  targetState: 'full' | 'first' | 'second';
  mode: SwapMode;
}

export interface SwapCandidate {
  id: string;
  slotId: string;
  targetPlayerId?: string;
  label: string;
  sublabel?: string;
  halfMinutes: number;
}

interface SwapOutModalProps {
  request: PendingSwapRequest | null;
  players: Player[];
  lineups: Record<IntervalKey, LineupSlot[]>;
  onConfirm: (candidate: SwapCandidate) => void;
  onCancel: () => void;
}

export const SwapOutModal: React.FC<SwapOutModalProps> = ({
  request,
  players,
  lineups,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!request) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [request, onCancel]);

  if (!request) return null;

  const playersById = new Map(players.map((p) => [p.id, p]));
  const incomingPlayer = playersById.get(request.playerId);
  const intervalMeta = INTERVALS.find((i) => i.key === request.interval);
  if (!incomingPlayer || !intervalMeta) return null;

  const slots = lineups[request.interval];
  const candidates: SwapCandidate[] = [];

  for (const slot of slots) {
    if (slot.kind === 'full') {
      const p = playersById.get(slot.playerId);
      if (!p || p.id === request.playerId) continue;
      const mins = getPlayerMinutes(lineups, p.id).halfMinutes;
      candidates.push({
        id: `${slot.id}-${p.id}`,
        slotId: slot.id,
        targetPlayerId: p.id,
        label: p.name,
        sublabel:
          request.mode === 'full'
            ? 'Komplett auf Bank'
            : request.mode === 'first'
            ? 'Geht 1. Hälfte (spielt 2. Hälfte)'
            : 'Spielt 1. Hälfte (geht 2. Hälfte)',
        halfMinutes: mins,
      });
    } else {
      const p1 = slot.firstId ? playersById.get(slot.firstId) : undefined;
      const p2 = slot.secondId ? playersById.get(slot.secondId) : undefined;

      if (request.mode === 'full') {
        if (p1 && p2) {
          const maxMins = Math.max(
            getPlayerMinutes(lineups, p1.id).halfMinutes,
            getPlayerMinutes(lineups, p2.id).halfMinutes
          );
          candidates.push({
            id: slot.id,
            slotId: slot.id,
            label: `${p1.name} / ${p2.name}`,
            sublabel: 'Split-Spot komplett ersetzen',
            halfMinutes: maxMins,
          });
        } else if (p1 || p2) {
          const single = p1 ?? p2!;
          candidates.push({
            id: `${slot.id}-${single.id}`,
            slotId: slot.id,
            targetPlayerId: single.id,
            label: single.name,
            sublabel: p1 ? 'Spielt bisher 1. Hälfte' : 'Spielt bisher 2. Hälfte',
            halfMinutes: getPlayerMinutes(lineups, single.id).halfMinutes,
          });
        }
      } else if (request.mode === 'first' && p1 && p1.id !== request.playerId) {
        candidates.push({
          id: `${slot.id}-first-${p1.id}`,
          slotId: slot.id,
          targetPlayerId: p1.id,
          label: p1.name,
          sublabel: p2
            ? `1. Hälfte raus (2. Hälfte bleibt ${p2.name})`
            : '1. Hälfte auf Bank',
          halfMinutes: getPlayerMinutes(lineups, p1.id).halfMinutes,
        });
      } else if (request.mode === 'second' && p2 && p2.id !== request.playerId) {
        candidates.push({
          id: `${slot.id}-second-${p2.id}`,
          slotId: slot.id,
          targetPlayerId: p2.id,
          label: p2.name,
          sublabel: p1
            ? `2. Hälfte raus (1. Hälfte bleibt ${p1.name})`
            : '2. Hälfte auf Bank',
          halfMinutes: getPlayerMinutes(lineups, p2.id).halfMinutes,
        });
      }
    }
  }

  candidates.sort((a, b) => b.halfMinutes - a.halfMinutes);

  const descriptionText =
    request.mode === 'full'
      ? `${intervalMeta.label} (${intervalMeta.range}) hat bereits 5 Spieler auf dem Feld. Wer geht für ${incomingPlayer.name} (4 Min) raus?`
      : request.mode === 'first'
      ? `Die 1. Hälfte (0–2') in ${intervalMeta.label} ist voll. Wer geht in der 1. Hälfte für ${incomingPlayer.name} raus?`
      : `Die 2. Hälfte (2–4') in ${intervalMeta.label} ist voll. Wer geht in der 2. Hälfte für ${incomingPlayer.name} raus?`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Spieler ersetzen für ${incomingPlayer.name}`}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl bg-white dark:bg-[#14171F] border border-stone-200 dark:border-white/[0.1] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-stone-200 dark:border-white/[0.08]">
          <div className="flex items-center gap-2 min-w-0">
            <ArrowLeftRight className="w-4 h-4 text-red-500 shrink-0" />
            <h2 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100 truncate">
              Wer geht für {incomingPlayer.name} raus?
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Abbrechen"
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
            {descriptionText}
          </p>

          <ul className="divide-y divide-stone-100 dark:divide-white/[0.06] rounded-xl border border-stone-200 dark:border-white/[0.08] overflow-hidden">
            {candidates.map((candidate) => (
              <li key={candidate.id}>
                <button
                  type="button"
                  onClick={() => onConfirm(candidate)}
                  className="w-full min-h-[48px] px-3.5 py-2.5 flex items-center justify-between gap-3 text-left bg-white dark:bg-[#14171F] hover:bg-red-500/[0.07] dark:hover:bg-red-500/[0.08] transition-colors cursor-pointer"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">
                      {candidate.label}
                    </div>
                    {candidate.sublabel && (
                      <div className="text-[11px] text-stone-500 dark:text-stone-400">
                        {candidate.sublabel}
                      </div>
                    )}
                  </div>
                  <span className="font-mono text-xs tabular-nums text-stone-500 dark:text-stone-400 shrink-0">
                    {candidate.halfMinutes}&apos; ({candidate.halfMinutes * 2}&apos;)
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="px-4 py-3 border-t border-stone-200 dark:border-white/[0.08] bg-stone-50/50 dark:bg-white/[0.02] flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg text-xs font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
};
