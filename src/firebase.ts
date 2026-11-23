import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';

interface AppletFirebaseConfig {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  firestoreDatabaseId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

const configModules = import.meta.glob<{ default: AppletFirebaseConfig }>(
  '/firebase-applet-config.json',
  { eager: true }
);

const bundledConfig = Object.values(configModules)[0]?.default;

function parseEnvFirebaseConfig(): Partial<AppletFirebaseConfig> | null {
  const raw = import.meta.env.VITE_FIREBASE_CONFIG;
  if (!raw || typeof raw !== 'string') return null;
  try {
    return JSON.parse(raw) as Partial<AppletFirebaseConfig>;
  } catch {
    console.error('Invalid VITE_FIREBASE_CONFIG JSON.');
    return null;
  }
}

const envConfig = parseEnvFirebaseConfig();

const firebaseConfig: AppletFirebaseConfig = {
  apiKey: envConfig?.apiKey || bundledConfig?.apiKey || '',
  authDomain: envConfig?.authDomain || bundledConfig?.authDomain || '',
  projectId: envConfig?.projectId || bundledConfig?.projectId || '',
  storageBucket: envConfig?.storageBucket || bundledConfig?.storageBucket || '',
  messagingSenderId:
    envConfig?.messagingSenderId || bundledConfig?.messagingSenderId || '',
  appId: envConfig?.appId || bundledConfig?.appId || '',
  firestoreDatabaseId:
    envConfig?.firestoreDatabaseId ||
    bundledConfig?.firestoreDatabaseId ||
    '(default)',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(
  app,
  firebaseConfig.firestoreDatabaseId || '(default)'
);
export const auth = getAuth(app);
export const FIREBASE_PROJECT_ID = firebaseConfig.projectId;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const USERNAME_PATTERN = /^[a-zA-Z0-9._-]+$/;

export function usernameToBackgroundEmail(username: string): string {
  return `${username.trim().toLowerCase()}@rotationsplaner.app`;
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes('the client is offline')
    ) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
