import { useEffect, type PropsWithChildren } from 'react';
import { Pressable, Text } from 'react-native';
import { act, render, userEvent, waitFor } from '../../../test/render';
import { AuthBootstrap, useAuthRuntime } from '../auth-bootstrap';
import type { FirebaseAuthUser } from '../../../services/auth-service';
import {
  createAnalyticsCache,
  type AnalyticsCacheStorage,
} from '@/lib/analytics/analytics-cache';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockReportDiagnostic = jest.fn();
const mockPurgeAnalyticsCache = jest.fn();
let mockSegments: string[] = ['(auth)', 'loading'];

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useSegments: () => mockSegments,
}));

jest.mock('@/lib/safe-diagnostics', () => ({
  reportDiagnostic: (...args: unknown[]) => mockReportDiagnostic(...args),
}));

jest.mock('@/lib/analytics/analytics-cache-runtime', () => ({
  purgeAnalyticsCache: (...args: unknown[]) => mockPurgeAnalyticsCache(...args),
}));

type Runtime = {
  authService: {
    onIdTokenChanged(
      listener: (user: FirebaseAuthUser | null) => void,
    ): () => void;
    getIdToken(forceRefresh?: boolean): Promise<string>;
    signOut(): Promise<void>;
  };
  deleteAccount?(): Promise<void>;
  getSetupStatus(): Promise<{ isComplete: boolean }>;
  configureApiSession(session: {
    clearSession(): Promise<void> | void;
    getIdToken(forceRefresh?: boolean): Promise<string>;
  }): void;
};

type TestableAuthBootstrap = (
  props: PropsWithChildren<{ loadRuntime: () => Promise<Runtime> }>,
) => React.ReactElement;

const TestAuthBootstrap = AuthBootstrap as unknown as TestableAuthBootstrap;

function verifiedUser(): FirebaseAuthUser {
  return {
    uid: 'firebase-user-1',
    email: null,
    emailVerified: true,
    displayName: null,
    photoUrl: null,
    providerIds: ['google.com'],
    updateProfile: jest.fn(),
    sendEmailVerification: jest.fn(),
    reload: jest.fn(),
    getIdToken: jest.fn(),
  };
}

function lifecycleCache() {
  const files = new Map<string, string>();
  const storage: AnalyticsCacheStorage = {
    read: async (path) => files.get(path) ?? null,
    write: async (path, value) => {
      files.set(path, value);
    },
    replace: async (from, to) => {
      const value = files.get(from);
      if (value === undefined) throw new Error('Missing staged cache file');
      files.set(to, value);
      files.delete(from);
    },
    remove: async (path) => {
      files.delete(path);
    },
    purgeDirectory: async (directory) => {
      for (const path of files.keys()) {
        if (path.startsWith(directory)) files.delete(path);
      }
    },
  };
  return {
    files,
    cache: createAnalyticsCache({
      storage,
      pathFor: (userId, key) => `analytics/${userId}/${key}.json`,
      userDirectoryFor: (userId) => `analytics/${userId}/`,
      now: () => 1_000,
      staleAfterMs: 500,
    }),
  };
}

function AnalyticsCleanupControls() {
  const { deleteAccount, signOut } = useAuthRuntime();
  return (
    <>
      <Pressable accessibilityRole="button" onPress={() => void signOut()}>
        <Text>Sign out from test</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => void deleteAccount()}
      >
        <Text>Delete account from test</Text>
      </Pressable>
    </>
  );
}

describe('AuthBootstrap initialization', () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockPush.mockClear();
    mockReportDiagnostic.mockClear();
    mockPurgeAnalyticsCache.mockReset();
    mockPurgeAnalyticsCache.mockResolvedValue(undefined);
    mockSegments = ['(auth)', 'loading'];
  });

  it('keeps the root navigation tree mounted while initialization resolves', async () => {
    const childMounted = jest.fn();
    const childUnmounted = jest.fn();
    function NavigationTree() {
      useEffect(() => {
        childMounted();
        return childUnmounted;
      }, []);
      return <Text>Protected content</Text>;
    }

    const runtime: Runtime = {
      authService: {
        onIdTokenChanged: jest.fn().mockReturnValue(jest.fn()),
        getIdToken: jest.fn(),
        signOut: jest.fn().mockResolvedValue(undefined),
      },
      getSetupStatus: jest.fn(),
      configureApiSession: jest.fn(),
    };
    let resolveRuntime: ((runtime: Runtime) => void) | undefined;
    const loadRuntime = () =>
      new Promise<Runtime>((resolve) => {
        resolveRuntime = resolve;
      });
    const screen = await render(
      <TestAuthBootstrap loadRuntime={loadRuntime}>
        <NavigationTree />
      </TestAuthBootstrap>,
    );

    expect(childMounted).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Protected content')).toBeTruthy();
    expect(childUnmounted).not.toHaveBeenCalled();
    resolveRuntime?.(runtime);
    screen.unmount();
  });

  it('routes runtime initialization failure to recovery without an inline overlay', async () => {
    const screen = await render(
      <TestAuthBootstrap
        loadRuntime={async () => {
          throw new Error('private native initialization detail');
        }}
      >
        <Text>Protected content</Text>
      </TestAuthBootstrap>,
    );

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/recovery');
    });
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(
      screen.queryByText(/private native initialization detail/i),
    ).toBeNull();
    expect(mockReportDiagnostic).toHaveBeenCalledWith(
      'auth_initialization_failed',
      expect.objectContaining({ operation: 'bootstrap_runtime' }),
    );
    screen.unmount();
  });

  it('routes setup-status failure to one recovery route without rendering an overlay', async () => {
    let listener: ((user: FirebaseAuthUser | null) => void) | undefined;
    const getSetupStatus = jest
      .fn()
      .mockRejectedValueOnce(new Error('private backend detail'))
      .mockResolvedValueOnce({ isComplete: true });
    const signOut = jest.fn().mockResolvedValue(undefined);
    const runtime: Runtime = {
      authService: {
        onIdTokenChanged(next) {
          listener = next;
          return jest.fn();
        },
        getIdToken: jest.fn(),
        signOut,
      },
      getSetupStatus,
      configureApiSession: jest.fn(),
    };
    const screen = await render(
      <TestAuthBootstrap loadRuntime={async () => runtime}>
        <Text>Protected content</Text>
      </TestAuthBootstrap>,
    );

    await act(async () => listener?.(verifiedUser()));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/recovery');
    });
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    expect(mockReplace).toHaveBeenCalledTimes(1);
    expect(mockPush).not.toHaveBeenCalled();
    await act(async () => listener?.(verifiedUser()));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
    expect(signOut).not.toHaveBeenCalled();
    expect(getSetupStatus).toHaveBeenCalledTimes(1);
    screen.unmount();
  });

  it('routes a signed-out listener callback to Sign In without setup lookup', async () => {
    let listener: ((user: null) => void) | undefined;
    const getSetupStatus = jest.fn();
    const runtime: Runtime = {
      authService: {
        onIdTokenChanged(next) {
          listener = next;
          return jest.fn();
        },
        getIdToken: jest.fn(),
        signOut: jest.fn().mockResolvedValue(undefined),
      },
      getSetupStatus,
      configureApiSession: jest.fn(),
    };
    const screen = await render(
      <TestAuthBootstrap loadRuntime={async () => runtime}>
        <Text>Protected content</Text>
      </TestAuthBootstrap>,
    );

    await act(async () => listener?.(null));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-in');
    });
    expect(getSetupStatus).not.toHaveBeenCalled();
    screen.unmount();
  });

  it('selects the authenticated route after onboarding marks setup complete', async () => {
    let listener: ((user: FirebaseAuthUser | null) => void) | undefined;
    const runtime: Runtime = {
      authService: {
        onIdTokenChanged(next) {
          listener = next;
          return jest.fn();
        },
        getIdToken: jest.fn(),
        signOut: jest.fn().mockResolvedValue(undefined),
      },
      getSetupStatus: jest.fn().mockResolvedValue({ isComplete: false }),
      configureApiSession: jest.fn(),
    };
    function CompletionControl() {
      const { markSetupComplete } = useAuthRuntime();
      return (
        <Pressable accessibilityRole="button" onPress={markSetupComplete}>
          <Text>Complete setup</Text>
        </Pressable>
      );
    }

    const screen = await render(
      <TestAuthBootstrap loadRuntime={async () => runtime}>
        <CompletionControl />
      </TestAuthBootstrap>,
    );

    await act(async () => listener?.(verifiedUser()));
    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(onboarding)');
    });
    mockSegments = ['(onboarding)'];
    await screen.findByRole('button', { name: 'Complete setup' });

    await userEvent
      .setup()
      .press(screen.getByRole('button', { name: 'Complete setup' }));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenLastCalledWith('/(tabs)/progress');
    });
    expect(mockReplace).not.toHaveBeenLastCalledWith('/(onboarding)');
    screen.unmount();
  });

  it('does not redirect repeatedly for equivalent signed-out callbacks', async () => {
    let listener: ((user: null) => void) | undefined;
    const runtime: Runtime = {
      authService: {
        onIdTokenChanged(next) {
          listener = next;
          return jest.fn();
        },
        getIdToken: jest.fn(),
        signOut: jest.fn().mockResolvedValue(undefined),
      },
      getSetupStatus: jest.fn(),
      configureApiSession: jest.fn(),
    };
    const screen = await render(
      <TestAuthBootstrap loadRuntime={async () => runtime}>
        <Text>Protected content</Text>
      </TestAuthBootstrap>,
    );

    await act(async () => listener?.(null));

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/(auth)/sign-in');
    });
    await act(async () => listener?.(null));
    await waitFor(() => expect(mockReplace).toHaveBeenCalledTimes(1));
    expect(mockReplace).toHaveBeenCalledTimes(1);
    screen.unmount();
  });

  it('keeps the auth store and listener across signed-out route navigation', async () => {
    let listener: ((user: null) => void) | undefined;
    const onIdTokenChanged = jest.fn((next) => {
      listener = next;
      return jest.fn();
    });
    const runtime: Runtime = {
      authService: {
        onIdTokenChanged,
        getIdToken: jest.fn(),
        signOut: jest.fn().mockResolvedValue(undefined),
      },
      getSetupStatus: jest.fn(),
      configureApiSession: jest.fn(),
    };
    const screen = await render(
      <TestAuthBootstrap loadRuntime={async () => runtime}>
        <Text>Protected content</Text>
      </TestAuthBootstrap>,
    );

    await act(async () => listener?.(null));
    mockSegments = ['(auth)', 'sign-in'];
    await act(async () =>
      screen.rerender(
        <TestAuthBootstrap loadRuntime={async () => runtime}>
          <Text>Protected content</Text>
        </TestAuthBootstrap>,
      ),
    );

    expect(onIdTokenChanged).toHaveBeenCalledTimes(1);
    expect(
      mockReportDiagnostic.mock.calls.filter(
        ([category]) => category === 'auth_initialization_started',
      ),
    ).toHaveLength(1);
    screen.unmount();
  });

  it('keeps one listener and cleans it up on unmount', async () => {
    const unsubscribe = jest.fn();
    const onIdTokenChanged = jest.fn().mockReturnValue(unsubscribe);
    const runtime: Runtime = {
      authService: {
        onIdTokenChanged,
        getIdToken: jest.fn(),
        signOut: jest.fn().mockResolvedValue(undefined),
      },
      getSetupStatus: jest.fn(),
      configureApiSession: jest.fn(),
    };
    const loadRuntime = async () => runtime;
    const screen = await render(
      <TestAuthBootstrap loadRuntime={loadRuntime}>
        <Text>Protected content</Text>
      </TestAuthBootstrap>,
    );

    await waitFor(() => expect(onIdTokenChanged).toHaveBeenCalledTimes(1));
    screen.rerender(
      <TestAuthBootstrap loadRuntime={loadRuntime}>
        <Text>Protected content</Text>
      </TestAuthBootstrap>,
    );
    await waitFor(() => expect(onIdTokenChanged).toHaveBeenCalledTimes(1));

    screen.unmount();
    await waitFor(() => expect(unsubscribe).toHaveBeenCalledTimes(1));
  });

  it('purges the signed-in user analytics cache before signing out', async () => {
    let listener: ((user: FirebaseAuthUser | null) => void) | undefined;
    const signOut = jest.fn().mockResolvedValue(undefined);
    const runtime: Runtime = {
      authService: {
        onIdTokenChanged(next) {
          listener = next;
          return jest.fn();
        },
        getIdToken: jest.fn(),
        signOut,
      },
      getSetupStatus: jest.fn().mockResolvedValue({ isComplete: true }),
      configureApiSession: jest.fn(),
    };
    const screen = await render(
      <TestAuthBootstrap loadRuntime={async () => runtime}>
        <AnalyticsCleanupControls />
      </TestAuthBootstrap>,
    );

    await act(async () => listener?.(verifiedUser()));
    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: 'Sign out from test' }));

    await waitFor(() => {
      expect(mockPurgeAnalyticsCache).toHaveBeenCalledWith('firebase-user-1');
    });
    expect(signOut).toHaveBeenCalledTimes(1);
    const purgeOrder = mockPurgeAnalyticsCache.mock.invocationCallOrder[0];
    const signOutOrder = signOut.mock.invocationCallOrder[0];
    expect(purgeOrder).toBeDefined();
    expect(signOutOrder).toBeDefined();
    expect(purgeOrder!).toBeLessThan(signOutOrder!);
    screen.unmount();
  });

  it('does not trap sign-out when coordinated analytics purge fails', async () => {
    let listener: ((user: FirebaseAuthUser | null) => void) | undefined;
    const signOut = jest.fn().mockResolvedValue(undefined);
    mockPurgeAnalyticsCache.mockRejectedValueOnce(
      new Error('cache unavailable'),
    );
    const runtime: Runtime = {
      authService: {
        onIdTokenChanged(next) {
          listener = next;
          return jest.fn();
        },
        getIdToken: jest.fn(),
        signOut,
      },
      getSetupStatus: jest.fn().mockResolvedValue({ isComplete: true }),
      configureApiSession: jest.fn(),
    };
    const screen = await render(
      <TestAuthBootstrap loadRuntime={async () => runtime}>
        <AnalyticsCleanupControls />
      </TestAuthBootstrap>,
    );

    await act(async () => listener?.(verifiedUser()));
    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: 'Sign out from test' }));

    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(mockPurgeAnalyticsCache).toHaveBeenCalledWith('firebase-user-1');
    screen.unmount();
  });

  it('purges and rewrites the same account cache without restarting the process', async () => {
    let listener: ((user: FirebaseAuthUser | null) => void) | undefined;
    const signOut = jest.fn().mockResolvedValue(undefined);
    const { cache, files } = lifecycleCache();
    await cache.write('firebase-user-1', 'insights-week', { total: 10 });
    mockPurgeAnalyticsCache.mockImplementation((userId: string) =>
      cache.purge(userId),
    );
    const runtime: Runtime = {
      authService: {
        onIdTokenChanged(next) {
          listener = next;
          return jest.fn();
        },
        getIdToken: jest.fn(),
        signOut,
      },
      getSetupStatus: jest.fn().mockResolvedValue({ isComplete: true }),
      configureApiSession: jest.fn(),
    };
    const screen = await render(
      <TestAuthBootstrap loadRuntime={async () => runtime}>
        <AnalyticsCleanupControls />
      </TestAuthBootstrap>,
    );

    await act(async () => listener?.(verifiedUser()));
    await userEvent
      .setup()
      .press(await screen.findByRole('button', { name: 'Sign out from test' }));
    await waitFor(() => expect(signOut).toHaveBeenCalledTimes(1));
    expect(files.size).toBe(0);

    await act(async () => listener?.(verifiedUser()));
    await cache.write('firebase-user-1', 'insights-week', { total: 20 });
    await expect(
      cache.read(
        'firebase-user-1',
        'insights-week',
        (value): value is { total: number } =>
          typeof value === 'object' &&
          value !== null &&
          typeof (value as { total?: unknown }).total === 'number',
      ),
    ).resolves.toMatchObject({ value: { total: 20 } });
    screen.unmount();
  });

  it('purges the signed-in user analytics cache after server account deletion', async () => {
    let listener: ((user: FirebaseAuthUser | null) => void) | undefined;
    const deleteAccount = jest.fn().mockResolvedValue(undefined);
    const runtime: Runtime = {
      authService: {
        onIdTokenChanged(next) {
          listener = next;
          return jest.fn();
        },
        getIdToken: jest.fn(),
        signOut: jest.fn().mockResolvedValue(undefined),
      },
      deleteAccount,
      getSetupStatus: jest.fn().mockResolvedValue({ isComplete: true }),
      configureApiSession: jest.fn(),
    };
    const screen = await render(
      <TestAuthBootstrap loadRuntime={async () => runtime}>
        <AnalyticsCleanupControls />
      </TestAuthBootstrap>,
    );

    await act(async () => listener?.(verifiedUser()));
    await userEvent.setup().press(
      await screen.findByRole('button', {
        name: 'Delete account from test',
      }),
    );

    await waitFor(() => {
      expect(deleteAccount).toHaveBeenCalledTimes(1);
      expect(mockPurgeAnalyticsCache).toHaveBeenCalledWith('firebase-user-1');
    });
    const deleteOrder = deleteAccount.mock.invocationCallOrder[0];
    const purgeOrder = mockPurgeAnalyticsCache.mock.invocationCallOrder[0];
    expect(deleteOrder).toBeDefined();
    expect(purgeOrder).toBeDefined();
    expect(deleteOrder!).toBeLessThan(purgeOrder!);
    screen.unmount();
  });
});
