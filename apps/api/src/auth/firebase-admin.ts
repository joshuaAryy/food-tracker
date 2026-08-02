import {
  cert,
  getApps,
  initializeApp,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getAuth, type Auth } from 'firebase-admin/auth';
import { AuthBoundaryError } from './types.js';
import { createFirebaseAdminAuthAdapter } from './firebase-admin-adapter.js';

type FirebaseAdminEnvironment = {
  [key: string]: string | undefined;
  FIREBASE_PROJECT_ID?: string;
  FIREBASE_CLIENT_EMAIL?: string;
  FIREBASE_PRIVATE_KEY?: string;
};

function firebaseServiceAccount(
  environment: FirebaseAdminEnvironment,
): ServiceAccount {
  const projectId = environment.FIREBASE_PROJECT_ID?.trim();
  const clientEmail = environment.FIREBASE_CLIENT_EMAIL?.trim();
  const privateKey = environment.FIREBASE_PRIVATE_KEY?.trim();
  if (
    projectId === undefined ||
    clientEmail === undefined ||
    privateKey === undefined
  ) {
    throw new AuthBoundaryError('AUTH_CONFIGURATION_ERROR');
  }

  return {
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, '\n'),
  };
}

export function createFirebaseAdminAuth(
  environment: FirebaseAdminEnvironment = process.env,
): Auth {
  const serviceAccount = firebaseServiceAccount(environment);
  const app =
    getApps()[0] ?? initializeApp({ credential: cert(serviceAccount) });
  return getAuth(app);
}

export function createConfiguredFirebaseAdminAuthAdapter(
  environment: FirebaseAdminEnvironment = process.env,
) {
  return createFirebaseAdminAuthAdapter(createFirebaseAdminAuth(environment));
}
