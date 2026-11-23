import React, { useEffect, useState } from 'react';
import { Check, Copy, Upload, X } from 'lucide-react';

interface MarkdownModalProps {
  isOpen: boolean;
  markdown: string;
  onClose: () => void;
  onImport: (rawMarkdown: string) => void;
  onCopy: () => void;
  copied: boolean;
}

export const MarkdownModal: React.FC<MarkdownModalProps> = ({
  isOpen,
  markdown,
  onClose,
  onImport,
  onCopy,
  copied,
}) => {
  const [tab, setTab] = useState<'export' | 'import'>('export');
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleImportSubmit = () => {
    const trimmed = importText.trim();
    if (!trimmed) {
      setImportError('Bitte füge zuerst einen Obsidian-Markdown-Text ein.');
      return;
    }
    setImportError(null);
    onImport(trimmed);
    setImportText('');
    setTab('export');
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Obsidian Markdown Export und Import"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl bg-white dark:bg-[#14171F] border border-stone-200 dark:border-white/[0.1] shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-stone-200 dark:border-white/[0.08]">
          <div className="flex items-center gap-3">
            <h2 className="font-display text-xl font-bold text-stone-900 dark:text-stone-100">
              Obsidian Markdown
            </h2>
            <div className="inline-flex items-center p-0.5 rounded-lg bg-stone-100 dark:bg-white/[0.05]">
              <button
                type="button"
                onClick={() => setTab('export')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  tab === 'export'
                    ? 'bg-white dark:bg-[#1E222D] text-stone-900 dark:text-stone-100 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                Vorschau
              </button>
              <button
                type="button"
                onClick={() => setTab('import')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  tab === 'import'
                    ? 'bg-white dark:bg-[#1E222D] text-stone-900 dark:text-stone-100 shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
                }`}
              >
                Importieren
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Schließen"
            className="p-2 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1">
          {tab === 'export' ? (
            <div className="space-y-3">
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Exaktes Dataview-Format für deine Obsidian-Spieltagsnotiz.
              </p>
              <pre className="p-4 rounded-xl bg-stone-50 dark:bg-[#0D0F14] border border-stone-200 dark:border-white/[0.08] font-mono text-xs leading-relaxed text-stone-800 dark:text-stone-200 overflow-x-auto whitespace-pre">
                {markdown}
              </pre>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-stone-500 dark:text-stone-400">
                Füge eine bestehende Obsidian-Notiz ein, um Kader und Lineups
                direkt zu übernehmen.
              </p>
              <textarea
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  setImportError(null);
                }}
                rows={12}
                placeholder={'---\ntype: gameplan\n---\n## Spieler\nSpieler:: [[Tim]], ...'}
                className="w-full p-3.5 rounded-xl bg-stone-50 dark:bg-[#0D0F14] border border-stone-200 dark:border-white/[0.1] font-mono text-xs leading-relaxed text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-2 focus:outline-orange-500"
              />
              {importError && (
                <p className="text-xs text-rose-500">{importError}</p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-3.5 border-t border-stone-200 dark:border-white/[0.08] bg-stone-50/50 dark:bg-white/[0.02]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            Schließen
          </button>

          {tab === 'export' ? (
            <button
              type="button"
              onClick={onCopy}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white inline-flex items-center gap-2 transition-colors"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Kopiert</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Markdown kopieren</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleImportSubmit}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-orange-500 hover:bg-orange-600 text-white inline-flex items-center gap-2 transition-colors"
            >
              <Upload className="w-4 h-4" />
              <span>Notiz übernehmen</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
