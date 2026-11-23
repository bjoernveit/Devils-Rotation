import React from 'react';
import { StickyNote, X } from 'lucide-react';

interface GameKeysNotesProps {
  value: string;
  onChange: (next: string) => void;
  onBlur?: () => void;
}

export const MAX_KEYS_NOTES_LENGTH = 4000;

export const GameKeysNotes: React.FC<GameKeysNotesProps> = ({
  value,
  onChange,
  onBlur,
}) => {
  return (
    <section
      aria-label="Schlüssel im Spiel"
      className="bg-white dark:bg-[#14171F] border border-stone-200 dark:border-white/[0.08] rounded-xl overflow-hidden"
    >
      <div className="px-4 py-3 border-b border-stone-200 dark:border-white/[0.08] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <StickyNote className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0" />
          <h2 className="font-display text-lg font-bold tracking-tight text-stone-900 dark:text-stone-100">
            Schlüssel im Spiel
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-mono text-[11px] tabular-nums text-stone-400 dark:text-stone-500">
            {value.length}/{MAX_KEYS_NOTES_LENGTH}
          </span>
          {value.length > 0 && (
            <button
              type="button"
              onClick={() => {
                onChange('');
                onBlur?.();
              }}
              aria-label="Notizen leeren"
              title="Notizen leeren"
              className="p-1 rounded text-stone-400 hover:text-rose-500 hover:bg-stone-100 dark:hover:bg-white/[0.06] transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="p-3">
        <textarea
          value={value}
          onChange={(e) =>
            onChange(e.target.value.slice(0, MAX_KEYS_NOTES_LENGTH))
          }
          onBlur={onBlur}
          rows={5}
          maxLength={MAX_KEYS_NOTES_LENGTH}
          placeholder="z. B. Transition-Defense stoppen, Pick & Roll aggressiv hedgen, Rebounds sichern, Topscorer eng verteidigen…"
          aria-label="Notizen für Schlüssel im Spiel"
          className="w-full rounded-lg px-3 py-2.5 text-sm leading-relaxed bg-stone-50 dark:bg-white/[0.04] border border-stone-200 dark:border-white/[0.1] text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-2 focus:outline-red-500 resize-y min-h-[120px]"
        />
      </div>
    </section>
  );
};
