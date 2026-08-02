export interface AccountDeletionRecord {
  firebaseUid: string;
  applicationUserId: string | null;
}

export interface AccountDeletionRepository {
  prepare(firebaseUid: string): Promise<AccountDeletionRecord>;
  complete(firebaseUid: string): Promise<void>;
}

export class AccountDeletionProviderError extends Error {
  constructor() {
    super('Account deletion provider operation failed.');
    this.name = 'AccountDeletionProviderError';
  }
}

export interface AccountDeletionDependencies {
  firebaseUid: string;
  repository: AccountDeletionRepository;
  deleteFirebaseUser(firebaseUid: string): Promise<void>;
}

export async function permanentlyDeleteAccount({
  firebaseUid,
  repository,
  deleteFirebaseUser,
}: AccountDeletionDependencies): Promise<void> {
  const record = await repository.prepare(firebaseUid);

  try {
    await deleteFirebaseUser(record.firebaseUid);
  } catch (error) {
    if (error instanceof AccountDeletionProviderError) throw error;
    throw new AccountDeletionProviderError();
  }

  await repository.complete(record.firebaseUid);
}
