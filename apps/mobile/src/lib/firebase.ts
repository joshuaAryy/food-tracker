import {
  createUserWithEmailAndPassword,
  getIdToken,
  getAuth,
  linkWithCredential,
  onIdTokenChanged,
  reload,
  sendPasswordResetEmail,
  sendEmailVerification,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  type AuthCredential,
  type User,
} from '@react-native-firebase/auth';
import type {
  AuthServiceAdapter,
  FirebaseAuthUser,
} from '../services/auth-service';
import { AuthenticationService } from '../services/auth-service';
import type { ProviderLinkingAdapter } from '../services/provider-linking';
import { AuthServiceError } from '../services/auth-errors';

function adaptUser(user: User | null): FirebaseAuthUser | null {
  if (user === null) return null;
  return {
    uid: user.uid,
    email: user.email,
    emailVerified: user.emailVerified,
    displayName: user.displayName,
    photoUrl: user.photoURL,
    providerIds: user.providerData.map((provider) => provider.providerId),
    updateProfile: (input) => updateProfile(user, input),
    sendEmailVerification: () => sendEmailVerification(user),
    reload: () => reload(user),
    getIdToken: (forceRefresh) => getIdToken(user, forceRefresh),
  };
}

export function createFirebaseAuthService(): AuthenticationService {
  const auth = getAuth();
  const adapter: AuthServiceAdapter = {
    get currentUser() {
      return adaptUser(auth.currentUser);
    },
    onIdTokenChanged(listener) {
      return onIdTokenChanged(auth, (user) => listener(adaptUser(user)));
    },
    createUserWithEmailAndPassword: (email, password) =>
      createUserWithEmailAndPassword(auth, email, password).then((result) => ({
        user: adaptUser(result.user) as FirebaseAuthUser,
      })),
    signInWithEmailAndPassword: (email, password) =>
      signInWithEmailAndPassword(auth, email, password).then((result) => ({
        user: adaptUser(result.user) as FirebaseAuthUser,
      })),
    sendPasswordResetEmail: (email) => sendPasswordResetEmail(auth, email),
    signInWithCredential: (credential) =>
      signInWithCredential(auth, credential as AuthCredential).then(
        (result) => ({
          user: adaptUser(result.user) as FirebaseAuthUser,
        }),
      ),
    signOut: () => signOut(auth),
  };
  return new AuthenticationService(adapter);
}

export function createFirebaseProviderLinkingAdapter(): ProviderLinkingAdapter {
  const auth = getAuth();
  return {
    getCurrentUser: () => adaptUser(auth.currentUser),
    linkWithCredential: async (credential) => {
      const currentUser = auth.currentUser;
      if (currentUser === null) throw new AuthServiceError('sessionExpired');
      const result = await linkWithCredential(
        currentUser,
        credential as AuthCredential,
      );
      return adaptUser(result.user) as FirebaseAuthUser;
    },
  };
}
