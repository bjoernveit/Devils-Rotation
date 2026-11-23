import React, { useMemo, useState } from 'react';
import {
  BookmarkPlus,
  Calendar,
  CopyCheck,
  Eye,
  FolderOpen,
  RefreshCw,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import { INTERVALS, Player, SavedGame } from '../types/rotation';
import { getPlayerMinutes } from '../utils/rotationLogic';
import { MAX_KEYS_NOTES_LENGTH } from './GameKeysNotes';

interface SavedGamesSectionProps {
  savedGames: SavedGame[];
  currentKeysNotes: string;
  saveModalOpen: boolean;
  onOpenSaveModal: () => void;
  onCloseSaveModal: () => void;
  onSaveNewGame: (data: {
    title: string;
    gameDate: string;
    keysNotes: string;
  }) => Promise<void>;
  onUpdateSavedGameWithCurrent: (game: SavedGame) => Promise<void>;
  onLoadAsBasis: (game: SavedGame) => void;
  onDeleteGame: (gameId: string) => Promise<void>;
}

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return dateStr;
}

export const SavedGamesSection: React.FC<SavedGamesSectionProps> = ({
  savedGames,
  currentKeysNotes,
  saveModalOpen,
  onOpenSaveModal,
  onCloseSaveModal,
  onSaveNewGame,
  onUpdateSavedGameWithCurrent,
  onLoadAsBasis,
  onDeleteGame,
}) => {
  const [title, setTitle] = useState('');
  const [gameDate, setGameDate] = useState(getTodayDateString);
  const [notesDraft, setNotesDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [inspectingId, setInspectingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [justLoadedId, setJustLoadedId] = useState<string | null>(null);

  const inspectingGame = useMemo(
    () => savedGames.find((g) => g.id === inspectingId) ?? null,
    [savedGames, inspectingId]
  );

  const inspectingMinutes = useMemo(() => {
    if (!inspectingGame) return [];
    return inspectingGame.players
      .filter((p) => p.active)
      .map((p) => ({
        player: p,
        ...getPlayerMinutes(inspectingGame.lineups, p.id),
      }))
      .sort((a, b) => {
        if (b.halfMinutes !== a.halfMinutes) {
          return b.halfMinutes - a.halfMinutes;
        }
        return a.player.name.localeCompare(b.player.name, 'de');
      });
  }, [inspectingGame]);

  const prevSaveModalOpenRef = React.useRef(false);

  React.useEffect(() => {
    if (saveModalOpen && !prevSaveModalOpenRef.current) {
      setTitle('');
      setGameDate(getTodayDateString());
      setNotesDraft(currentKeysNotes);
      setFormError(null);
    }
    prevSaveModalOpenRef.current = saveModalOpen;
  }, [saveModalOpen, currentKeysNotes]);

  const handleSubmitSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = title.trim();
    if (!trimmed) {
      setFormError('Bitte gib einen Spielnamen oder Gegner ein.');
      return;
    }
    setFormError(null);
    setSaving(true);
    try {
      await onSaveNewGame({
        title: trimmed.slice(0, 80),
        gameDate: gameDate.trim().slice(0, 20),
        keysNotes: notesDraft.slice(0, MAX_KEYS_NOTES_LENGTH),
      });
      onCloseSaveModal();
    } finally {
      setSaving(false);
    }
  };

  const handleBasisLoad = (game: SavedGame) => {
    onLoadAsBasis(game);
    setJustLoadedId(game.id);
    setTimeout(() => {
      setJustLoadedId((curr) => (curr === game.id ? null : curr));
    }, 2000);
    setInspectingId(null);
  };

  const renderSlotText = (
    playersById: Map<string, Player>,
    slots: SavedGame['lineups'][keyof SavedGame['lineups']]
  ): string[] => {
    return slots
      .map((slot) => {
        if (slot.kind === 'full') {
          return playersById.get(slot.playerId)?.name ?? null;
        }
        const n1 = slot.firstId ? playersById.get(slot.firstId)?.name : null;
        const n2 = slot.secondId ? playersById.get(slot.secondId)?.name : null;
        if (n1 && n2) return `${n1} / ${n2}`;
        if (n1) return `${n1} (1. H)`;
        if (n2) return `${n2} (2. H)`;
        return null;
      })
      .filter((x): x is string => Boolean(x));
  };

  return (
    <section aria-label="Gespeicherte Spiele" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="font-display text-lg font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Gespeicherte Spiele
          </h2>
          <span className="text-xs text-stone-500 dark:text-stone-400">
            {savedGames.length}{' '}
            {savedGames.length === 1 ? 'Spiel gespeichert' : 'Spiele gespeichert'}
          </span>
        </div>

        <button
          type="button"
          onClick={onOpenSaveModal}
          className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <BookmarkPlus className="w-4 h-4" />
          <span>Aktuelles Lineup speichern</span>
        </button>
      </div>

      {savedGames.length === 0 ? (
        <div className="rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#14171F] p-6 text-center space-y-2">
          <p className="text-sm text-stone-600 dark:text-stone-300">
            Noch keine Spiele gespeichert.
          </p>
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Speichere dein geplantes Lineup inklusive „Schlüssel im Spiel“, um
            es später einzusehen oder als Basis für einen neuen Spieltag zu
            nutzen.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {savedGames.map((game) => {
            const activeCount = game.players.filter((p) => p.active).length;
            const dateFormatted = formatDisplayDate(game.gameDate);
            const hasNotes = Boolean(game.keysNotes?.trim());

            return (
              <div
                key={game.id}
                className="rounded-xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#14171F] p-4 flex flex-col justify-between gap-3"
              >
                <div className="space-y-2 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setInspectingId(game.id);
                        setConfirmDeleteId(null);
                      }}
                      className="text-left font-display text-base font-bold text-stone-900 dark:text-stone-100 hover:text-red-600 dark:hover:text-red-400 transition-colors truncate cursor-pointer"
                    >
                      {game.title}
                    </button>

                    {dateFormatted && (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] text-stone-500 dark:text-stone-400 shrink-0">
                        <Calendar className="w-3 h-3" />
                        {dateFormatted}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-stone-500 dark:text-stone-400">
                    {activeCount} aktive Spieler
                  </div>

                  {hasNotes && (
                    <p className="text-xs text-stone-600 dark:text-stone-300 line-clamp-2 bg-stone-50 dark:bg-white/[0.03] rounded-lg px-2.5 py-2 border border-stone-100 dark:border-white/[0.05]">
                      {game.keysNotes}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-stone-100 dark:border-white/[0.06]">
                  <button
                    type="button"
                    onClick={() => {
                      setInspectingId(game.id);
                      setConfirmDeleteId(null);
                    }}
                    className="flex-1 min-w-[96px] h-9 px-2.5 rounded-lg text-xs font-medium border border-stone-200 dark:border-white/[0.1] bg-stone-50 dark:bg-white/[0.03] text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/[0.08] inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Einsehen</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleBasisLoad(game)}
                    className="flex-1 min-w-[116px] h-9 px-2.5 rounded-lg text-xs font-semibold bg-red-600/10 hover:bg-red-600/20 text-red-700 dark:text-red-400 border border-red-600/25 inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    title="Lineup & Schlüssel als Basis in den Planer laden"
                  >
                    {justLoadedId === game.id ? (
                      <>
                        <CopyCheck className="w-3.5 h-3.5" />
                        <span>Geladen</span>
                      </>
                    ) : (
                      <>
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Als Basis nutzen</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Save Current Plan for a Game Modal */}
      {saveModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Spielplan speichern"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={onCloseSaveModal}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-stone-200 dark:border-white/[0.1] bg-white dark:bg-[#14171F] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-stone-200 dark:border-white/[0.08] flex items-center justify-between gap-3">
              <h3 className="font-display text-lg font-bold text-stone-900 dark:text-stone-100">
                Lineup für Spiel speichern
              </h3>
              <button
                type="button"
                onClick={onCloseSaveModal}
                aria-label="Schließen"
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/[0.06] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitSave} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="save-game-title"
                  className="block text-xs font-medium text-stone-600 dark:text-stone-300"
                >
                  Spiel / Gegner
                </label>
                <input
                  id="save-game-title"
                  type="text"
                  required
                  maxLength={80}
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="z. B. Heimspiel vs. TV Jahn"
                  className="w-full h-11 px-3.5 rounded-xl text-sm bg-stone-50 dark:bg-white/[0.04] border border-stone-200 dark:border-white/[0.1] text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-2 focus:outline-red-500"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="save-game-date"
                  className="block text-xs font-medium text-stone-600 dark:text-stone-300"
                >
                  Spieldatum (optional)
                </label>
                <input
                  id="save-game-date"
                  type="date"
                  value={gameDate}
                  onChange={(e) => setGameDate(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl text-sm bg-stone-50 dark:bg-white/[0.04] border border-stone-200 dark:border-white/[0.1] text-stone-900 dark:text-stone-100 focus:outline-2 focus:outline-red-500"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="save-game-notes"
                  className="block text-xs font-medium text-stone-600 dark:text-stone-300"
                >
                  Schlüssel im Spiel
                </label>
                <textarea
                  id="save-game-notes"
                  rows={4}
                  maxLength={MAX_KEYS_NOTES_LENGTH}
                  value={notesDraft}
                  onChange={(e) => setNotesDraft(e.target.value)}
                  placeholder="Taktische Schwerpunkte, Matchups, Schlüsselpunkte…"
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm bg-stone-50 dark:bg-white/[0.04] border border-stone-200 dark:border-white/[0.1] text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-2 focus:outline-red-500 resize-y"
                />
              </div>

              {formError && (
                <p className="text-xs text-rose-600 dark:text-rose-400">
                  {formError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={onCloseSaveModal}
                  className="px-4 py-2 rounded-lg text-xs font-medium border border-stone-200 dark:border-white/[0.1] text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/[0.06] cursor-pointer"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white cursor-pointer"
                >
                  {saving ? 'Speichere…' : 'Speichern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inspect Saved Game Modal */}
      {inspectingGame && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Spiel einsehen: ${inspectingGame.title}`}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
          onClick={() => setInspectingId(null)}
        >
          <div
            className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl border border-stone-200 dark:border-white/[0.1] bg-white dark:bg-[#14171F] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-stone-200 dark:border-white/[0.08] flex items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
                  {inspectingGame.title}
                </h3>
                {inspectingGame.gameDate && (
                  <p className="font-mono text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    {formatDisplayDate(inspectingGame.gameDate)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setInspectingId(null)}
                aria-label="Schließen"
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/[0.06] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5">
              {/* Schlüssel im Spiel */}
              <div className="rounded-xl border border-stone-200 dark:border-white/[0.08] bg-stone-50 dark:bg-white/[0.02] p-3.5 space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 dark:text-stone-200">
                  <StickyNote className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                  <span>Schlüssel im Spiel</span>
                </div>
                <p className="text-sm text-stone-700 dark:text-stone-200 whitespace-pre-wrap leading-relaxed">
                  {inspectingGame.keysNotes?.trim()
                    ? inspectingGame.keysNotes
                    : 'Keine Notizen hinterlegt.'}
                </p>
              </div>

              {/* 5 Intervals Snapshot */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                  Geplante Lineups
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                  {INTERVALS.map(({ key, label, range }) => {
                    const playersById = new Map(
                      inspectingGame.players.map((p) => [p.id, p])
                    );
                    const lines = renderSlotText(
                      playersById,
                      inspectingGame.lineups[key] ?? []
                    );

                    return (
                      <div
                        key={key}
                        className="rounded-xl border border-stone-200 dark:border-white/[0.08] bg-stone-50/70 dark:bg-white/[0.02] p-3 space-y-2"
                      >
                        <div className="flex items-baseline justify-between gap-1 border-b border-stone-200/70 dark:border-white/[0.06] pb-1.5">
                          <span className="font-mono text-xs font-semibold text-red-600 dark:text-red-400">
                            {range}
                          </span>
                          <span className="text-[11px] text-stone-500 dark:text-stone-400 truncate">
                            {label}
                          </span>
                        </div>
                        {lines.length === 0 ? (
                          <p className="text-xs text-stone-400">Leer</p>
                        ) : (
                          <ul className="space-y-1 text-xs font-medium text-stone-800 dark:text-stone-200">
                            {lines.map((line, i) => (
                              <li key={`${key}-${i}`} className="truncate">
                                {line}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Minutes Summary */}
              {inspectingMinutes.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400">
                    Minutenverteilung (Halbzeit / Gesamt)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                    {inspectingMinutes.map(
                      ({ player, halfMinutes, fullMinutes }) => (
                        <div
                          key={player.id}
                          className="rounded-lg border border-stone-200 dark:border-white/[0.08] px-2.5 py-2 flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="font-medium text-stone-800 dark:text-stone-200 truncate">
                            {player.name}
                          </span>
                          <span className="font-mono tabular-nums text-stone-500 dark:text-stone-400 shrink-0">
                            {halfMinutes} ({fullMinutes})&apos;
                          </span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer Actions */}
            <div className="px-5 py-4 border-t border-stone-200 dark:border-white/[0.08] bg-stone-50/70 dark:bg-white/[0.02] flex flex-wrap items-center justify-between gap-3">
              <div>
                {confirmDeleteId === inspectingGame.id ? (
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={async () => {
                        await onDeleteGame(inspectingGame.id);
                        setConfirmDeleteId(null);
                        setInspectingId(null);
                      }}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                    >
                      Wirklich löschen?
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 cursor-pointer"
                    >
                      Abbrechen
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(inspectingGame.id)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-500 hover:text-rose-600 dark:hover:text-rose-400 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Löschen</span>
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={updatingId === inspectingGame.id}
                  onClick={async () => {
                    setUpdatingId(inspectingGame.id);
                    try {
                      await onUpdateSavedGameWithCurrent(inspectingGame);
                    } finally {
                      setUpdatingId(null);
                    }
                  }}
                  className="px-3.5 py-2 rounded-lg text-xs font-medium border border-stone-200 dark:border-white/[0.1] bg-white dark:bg-[#1B1F2A] text-stone-700 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/[0.06] inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Überschreibt dieses gespeicherte Spiel mit dem aktuell geplanten Lineup"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>
                    {updatingId === inspectingGame.id
                      ? 'Aktualisiere…'
                      : 'Aktuellen Plan hier speichern'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleBasisLoad(inspectingGame)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-700 text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Als Basis für neuen Spieltag nutzen</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
