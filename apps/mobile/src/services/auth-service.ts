import {
  AuthServiceError,
  normalizeAuthError,
  validatePassword,
} from './auth-errors';

export interface FirebaseAuthUser {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  photoUrl: string | null;
  providerIds: string[];
  updateProfile(input: { displayName: string }): Promise<void>;
  sendEmailVerification(): Promise<void>;
  reload(): Promise<void>;
  getIdToken(forceRefresh?: boolean): Promise<string | null>;
}

export interface AuthServiceAdapter {
  currentUser: FirebaseAuthUser | null;
  onIdTokenChanged(
    listener: (user: FirebaseAuthUser | null) => void,
  ): () => void;
  createUserWithEmailAndPassword(
    email: string,
    password: string,
  ): Promise<{ user: FirebaseAuthUser }>;
  signInWithEmailAndPassword(
    email: string,
    password: string,
  ): Promise<{ user: FirebaseAuthUser }>;
  sendPasswordResetEmail(email: string): Promise<void>;
  signInWithCredential(
    credential: unknown,
  ): Promise<{ user: FirebaseAuthUser }>;
  signOut(): Promise<void>;
}

export type CreateAccountInput = {
  name: string;
  email: string;
  password: string;
};

export class AuthenticationService {
  constructor(private readonly adapter: AuthServiceAdapter) {}

  onIdTokenChanged(
    listener: (user: FirebaseAuthUser | null) => void,
  ): () => void {
    return this.adapter.onIdTokenChanged(listener);
  }

  async createAccount(input: CreateAccountInput): Promise<FirebaseAuthUser> {
    const passwordValidation = validatePassword(input.password);
    if (!passwordValidation.ok) {
      throw new AuthServiceError(passwordValidation.code);
    }

    try {
      const credential = await this.adapter.createUserWithEmailAndPassword(
        input.email.trim(),
        input.password,
      );
      const name = input.name.trim();
      if (name !== '')
        await credential.user.updateProfile({ displayName: name });
      await credential.user.sendEmailVerification();
      return credential.user;
    } catch (error) {
      throw normalizeAuthError(error);
    }
  }

  async signInWithEmail(
    email: string,
    password: string,
  ): Promise<FirebaseAuthUser> {
    try {
      const credential = await this.adapter.signInWithEmailAndPassword(
        email.trim(),
        password,
      );
      return credential.user;
    } catch (error) {
      throw normalizeAuthError(error);
    }
  }

  async signInWithCredential(credential: unknown): Promise<FirebaseAuthUser> {
    try {
      return (await this.adapter.signInWithCredential(credential)).user;
    } catch (error) {
      throw normalizeAuthError(error);
    }
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      await this.adapter.sendPasswordResetEmail(email.trim());
    } catch (error) {
      if (providerCode(error) === 'auth/user-not-found') return;
      throw normalizeAuthError(error);
    }
  }

  async resendVerification(): Promise<void> {
    const user = this.adapter.currentUser;
    if (user === null) throw new AuthServiceError('verificationRequired');
    try {
      await user.sendEmailVerification();
    } catch (error) {
      throw normalizeAuthError(error);
    }
  }

  async refreshVerificationStatus(): Promise<FirebaseAuthUser> {
    const user = this.adapter.currentUser;
    if (user === null) throw new AuthServiceError('verificationRequired');
    try {
      await user.reload();
      return user;
    } catch (error) {
      throw normalizeAuthError(error);
    }
  }

  async getIdToken(forceRefresh = false): Promise<string> {
    const user = this.adapter.currentUser;
    if (user === null) throw new AuthServiceError('sessionExpired');
    try {
      const token = await user.getIdToken(forceRefresh);
      if (token === null || token === '') {
        throw new AuthServiceError('sessionExpired');
      }
      return token;
    } catch (error) {
      throw normalizeAuthError(error);
    }
  }

  async signOut(): Promise<void> {
    try {
      await this.adapter.signOut();
    } catch (error) {
      throw normalizeAuthError(error);
    }
  }
}

function providerCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}
