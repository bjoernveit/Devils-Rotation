import React, { useMemo, useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { IntervalKey, LineupSlot, Player } from '../types/rotation';
import { getPlayerMinutes } from '../utils/rotationLogic';

interface RosterPanelProps {
  players: Player[];
  lineups: Record<IntervalKey, LineupSlot[]>;
  selectedPlayerId: string | null;
  onSelectPlayer: (playerId: string | null) => void;
  onAddPlayer: (name: string) => void;
  onUpdatePlayer: (playerId: string, patch: Partial<Player>) => void;
  onDeletePlayer: (playerId: string) => void;
}

export const RosterPanel: React.FC<RosterPanelProps> = ({
  players,
  lineups,
  selectedPlayerId,
  onSelectPlayer,
  onAddPlayer,
  onUpdatePlayer,
  onDeletePlayer,
}) => {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const activeCount = useMemo(
    () => players.filter((p) => p.active).length,
    [players]
  );

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;
    onAddPlayer(trimmed);
    setNewName('');
  };

  const commitRename = (playerId: string) => {
    const trimmed = editName.trim();
    if (trimmed) {
      onUpdatePlayer(playerId, { name: trimmed });
    }
    setEditingId(null);
  };

  return (
    <section
      aria-label="Kader"
      className="bg-white dark:bg-[#14171F] border border-stone-200 dark:border-white/[0.08] rounded-xl overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-stone-200 dark:border-white/[0.08] flex items-baseline justify-between gap-2">
        <h2 className="font-display text-lg font-bold tracking-tight text-stone-900 dark:text-stone-100">
          Kader
        </h2>
        <span className="font-mono text-xs tabular-nums text-stone-500 dark:text-stone-400">
          {activeCount}/{players.length} aktiv
        </span>
      </div>

      {/* Add Player Form */}
      <form
        onSubmit={handleAdd}
        className="p-3 border-b border-stone-100 dark:border-white/[0.06]"
      >
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Neuer Spieler…"
            aria-label="Spielername"
            className="flex-1 min-w-0 h-10 px-3 rounded-lg text-sm bg-stone-50 dark:bg-white/[0.04] border border-stone-200 dark:border-white/[0.1] text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-2 focus:outline-red-500"
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            aria-label="Spieler hinzufügen"
            className="h-10 px-3.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:pointer-events-none text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Dazu</span>
          </button>
        </div>
      </form>

      {/* Flat Player List */}
      <div className="p-2">
        {players.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-stone-400 dark:text-stone-500">
            Noch keine Spieler im Kader.
          </p>
        ) : (
          <ul className="divide-y divide-stone-100 dark:divide-white/[0.04]">
            {players.map((player) => {
              const { halfMinutes } = getPlayerMinutes(lineups, player.id);
              const isEditing = editingId === player.id;
              const isSelected = selectedPlayerId === player.id;

              return (
                <li
                  key={player.id}
                  className={`flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 min-h-[44px] transition-colors ${
                    isSelected
                      ? 'bg-red-500/10'
                      : 'hover:bg-stone-50 dark:hover:bg-white/[0.03]'
                  } ${!player.active ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      checked={player.active}
                      onChange={(e) =>
                        onUpdatePlayer(player.id, {
                          active: e.target.checked,
                        })
                      }
                      aria-label={`${player.name} am Spieltag aktiv`}
                      title="Am Spieltag dabei"
                      className="w-4 h-4 rounded accent-red-600 cursor-pointer shrink-0"
                    />

                    {isEditing ? (
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitRename(player.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                          className="flex-1 min-w-0 h-8 px-2 rounded text-sm bg-white dark:bg-[#1B1F2A] border border-red-500 text-stone-900 dark:text-stone-100 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => commitRename(player.id)}
                          aria-label="Speichern"
                          className="p-1.5 text-emerald-500 hover:bg-stone-100 dark:hover:bg-white/[0.06] rounded"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          aria-label="Abbrechen"
                          className="p-1.5 text-stone-400 hover:bg-stone-100 dark:hover:bg-white/[0.06] rounded"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          onSelectPlayer(isSelected ? null : player.id)
                        }
                        className="text-sm font-medium text-stone-900 dark:text-stone-100 truncate text-left flex-1"
                      >
                        {player.name}
                      </button>
                    )}
                  </div>

                  {!isEditing && (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="font-mono text-xs tabular-nums text-stone-500 dark:text-stone-400 mr-1">
                        {halfMinutes}&apos;
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(player.id);
                          setEditName(player.name);
                        }}
                        aria-label={`${player.name} umbenennen`}
                        className="p-1.5 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/[0.06] transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeletePlayer(player.id)}
                        aria-label={`${player.name} löschen`}
                        className="p-1.5 rounded text-stone-400 hover:text-rose-500 hover:bg-stone-100 dark:hover:bg-white/[0.06] transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
};
