import { describe, expect, it } from 'vitest';
import {
  addSceneDelegateToXcodeProject,
  applySceneLifecycleToAppDelegate,
  createSceneDelegateSource,
  ensureApplicationSceneManifest,
} from './with-ios-scene-lifecycle';
import type { XcodeProject } from 'xcode';

const generatedAppDelegate = `
import Expo
import FirebaseCore
import React
import ReactAppDependencyProvider

@main
class AppDelegate: ExpoAppDelegate {
  var window: UIWindow?
  var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()
    reactNativeDelegate = delegate
    reactNativeFactory = factory
    window = UIWindow(frame: UIScreen.main.bounds)
    FirebaseApp.configure()
    factory.startReactNative(withModuleName: "main", in: window, launchOptions: launchOptions)
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }
  // Linking API
}
`;

describe('iOS scene lifecycle config plugin', () => {
  it('adds a single default application scene manifest', () => {
    const result = ensureApplicationSceneManifest({});

    expect(result).toEqual({
      UIApplicationSceneManifest: {
        UIApplicationSupportsMultipleScenes: false,
        UISceneConfigurations: {
          UIWindowSceneSessionRoleApplication: [
            {
              UISceneConfigurationName: 'Default Configuration',
              UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate',
            },
          ],
        },
      },
    });
  });

  it('preserves the generated native initialization while moving window ownership to scenes', () => {
    const result = applySceneLifecycleToAppDelegate(generatedAppDelegate);

    expect(result).toContain('class AppDelegate: ExpoAppDelegate');
    expect(result).toContain(
      'configurationForConnecting connectingSceneSession',
    );
    expect(result).toContain('FirebaseApp.configure()');
    expect(result).not.toContain(
      'window = UIWindow(frame: UIScreen.main.bounds)',
    );
    expect(result).not.toContain('factory.startReactNative(');
  });

  it('generates one scene-owned window and one React Native factory start', () => {
    const result = createSceneDelegateSource();

    expect(result).toContain('internal import Expo');
    expect(result).not.toContain('\nimport Expo\n');
    expect(result).toContain(
      'class SceneDelegate: UIResponder, UIWindowSceneDelegate',
    );
    expect(result).toContain('UIWindow(windowScene: windowScene)');
    expect(result.match(/startReactNative\(/g)).toHaveLength(1);
    expect(result).toContain('openURLContexts URLContexts');
    expect(result).toContain('continue userActivity: NSUserActivity');
    expect(result).toContain('application(UIApplication.shared, open: url');
  });

  it('is idempotent when the generated AppDelegate is already scene-aware', () => {
    const once = applySceneLifecycleToAppDelegate(generatedAppDelegate);
    expect(applySceneLifecycleToAppDelegate(once)).toBe(once);
  });

  it('adds SceneDelegate to the FoodTracker target once', () => {
    let hasFile = false;
    let addCount = 0;
    const project = {
      hash: {
        project: {
          objects: {
            PBXGroup: {
              FOOD_TRACKER_GROUP: { name: 'FoodTracker' },
            },
          },
        },
      },
      pbxTargetByName: () => ({ uuid: 'FOOD_TRACKER_TARGET' }),
      getFirstTarget: () => ({ uuid: 'FOOD_TRACKER_TARGET' }),
      hasFile: () => hasFile,
      addSourceFile: () => {
        hasFile = true;
        addCount += 1;
      },
    } as unknown as XcodeProject;

    addSceneDelegateToXcodeProject(project);
    addSceneDelegateToXcodeProject(project);

    expect(addCount).toBe(1);
  });
});
