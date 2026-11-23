import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'Unbekannter Fehler',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-stone-50 dark:bg-[#0D0F14] text-stone-900 dark:text-stone-100">
          <div className="w-full max-w-md rounded-2xl border border-stone-200 dark:border-white/[0.1] bg-white dark:bg-[#14171F] p-6 space-y-4">
            <h1 className="font-display text-xl font-bold">
              Verbindungs- oder Berechtigungsfehler
            </h1>
            <p className="text-sm text-stone-600 dark:text-stone-400">
              Beim Laden oder Speichern deiner Daten ist ein Fehler aufgetreten.
            </p>
            <pre className="p-3 rounded-lg bg-stone-100 dark:bg-[#0D0F14] text-xs font-mono overflow-x-auto text-rose-500">
              {this.state.message}
            </pre>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="w-full py-2.5 px-4 rounded-lg text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white transition-colors cursor-pointer"
            >
              Neu laden
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
