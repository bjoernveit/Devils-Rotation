import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import {
  auth,
  db,
  FIREBASE_PROJECT_ID,
  handleFirestoreError,
  OperationType,
  USERNAME_PATTERN,
  usernameToBackgroundEmail,
} from '../firebase';

type AuthMode = 'login' | 'register';

export const AuthScreen: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [providerDisabled, setProviderDisabled] = useState(false);

  const mapAuthError = (code: string): string => {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'Dieser Benutzername ist bereits vergeben.';
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Benutzername oder Passwort ist falsch.';
      case 'auth/weak-password':
        return 'Das Passwort muss mindestens 6 Zeichen lang sein.';
      case 'auth/operation-not-allowed':
        setProviderDisabled(true);
        return 'Die Anmeldung mit Benutzername & Passwort (E-Mail/Passwort-Provider) ist in der Firebase Console noch nicht aktiviert.';
      case 'auth/too-many-requests':
        return 'Zu viele Versuche. Bitte warte einen Moment.';
      default:
        return 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setProviderDisabled(false);

    const trimmed = username.trim();
    if (trimmed.length < 3 || trimmed.length > 30 || !USERNAME_PATTERN.test(trimmed)) {
      setError(
        'Benutzername: 3–30 Zeichen (Buchstaben, Zahlen, Punkt, _ oder -).'
      );
      return;
    }

    if (password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen lang sein.');
      return;
    }

    setSubmitting(true);
    const backgroundEmail = usernameToBackgroundEmail(trimmed);

    try {
      if (mode === 'register') {
        const cred = await createUserWithEmailAndPassword(
          auth,
          backgroundEmail,
          password
        );
        await updateProfile(cred.user, { displayName: trimmed });

        const userPath = `users/${cred.user.uid}`;
        try {
          await setDoc(doc(db, 'users', cred.user.uid), {
            uid: cred.user.uid,
            username: trimmed,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (fsErr) {
          handleFirestoreError(fsErr, OperationType.CREATE, userPath);
        }
      } else {
        await signInWithEmailAndPassword(auth, backgroundEmail, password);
      }
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code: unknown }).code)
          : '';
      setError(mapAuthError(code));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-stone-50 dark:bg-[#0D0F14] text-stone-900 dark:text-stone-100">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1.5">
          <h1 className="font-display text-3xl font-bold tracking-tight">
            Rotationsplaner
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400">
            Melde dich an, um deine Spieltagsrotation zu speichern.
          </p>
        </div>

        <div className="rounded-2xl border border-stone-200 dark:border-white/[0.08] bg-white dark:bg-[#14171F] p-5 space-y-5">
          {/* Mode Switcher */}
          <div
            role="tablist"
            aria-label="Anmeldeart"
            className="grid grid-cols-2 p-1 rounded-xl bg-stone-100 dark:bg-white/[0.05]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                mode === 'login'
                  ? 'bg-white dark:bg-[#1E222D] text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              Anmelden
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`py-2 text-xs font-semibold rounded-lg transition-colors cursor-pointer ${
                mode === 'register'
                  ? 'bg-white dark:bg-[#1E222D] text-stone-900 dark:text-stone-100 shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200'
              }`}
            >
              Registrieren
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label
                htmlFor="auth-username"
                className="block text-xs font-medium text-stone-600 dark:text-stone-300"
              >
                Benutzername
              </label>
              <input
                id="auth-username"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="z. B. coach_tim"
                className="w-full h-11 px-3.5 rounded-xl text-sm bg-stone-50 dark:bg-white/[0.04] border border-stone-200 dark:border-white/[0.1] text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-2 focus:outline-red-500"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="auth-password"
                className="block text-xs font-medium text-stone-600 dark:text-stone-300"
              >
                Passwort
              </label>
              <input
                id="auth-password"
                type="password"
                required
                minLength={6}
                autoComplete={
                  mode === 'register' ? 'new-password' : 'current-password'
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mindestens 6 Zeichen"
                className="w-full h-11 px-3.5 rounded-xl text-sm bg-stone-50 dark:bg-white/[0.04] border border-stone-200 dark:border-white/[0.1] text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-2 focus:outline-red-500"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-600 dark:text-rose-300 space-y-2">
                <p>{error}</p>
                {providerDisabled && FIREBASE_PROJECT_ID && (
                  <p className="text-[11px] text-rose-500 dark:text-rose-400">
                    Firebase Console → Authentication → Sign-in method →
                    „E-Mail/Passwort“ aktivieren (Projekt: {FIREBASE_PROJECT_ID}).
                  </p>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white transition-colors cursor-pointer"
            >
              {submitting
                ? 'Bitte warten…'
                : mode === 'register'
                ? 'Konto erstellen'
                : 'Anmelden'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
