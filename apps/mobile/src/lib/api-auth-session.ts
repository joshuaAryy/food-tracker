export interface ApiAuthSession {
  getIdToken(forceRefresh?: boolean): Promise<string>;
  clearSession(): Promise<void> | void;
}
