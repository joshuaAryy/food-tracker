import { describe, expect, it } from 'vitest';
import {
  ensurePodfileDeploymentTargetPostInstall,
  IOS_DEPLOYMENT_TARGET,
} from './with-ios-deployment-target';

const podfile = `target 'FoodTracker' do
  post_install do |installer|
    react_native_post_install(installer, config[:reactNativePath])
  end
end
`;

describe('iOS deployment-target config plugin', () => {
  it('normalizes every CocoaPods target configuration in post_install', () => {
    const result = ensurePodfileDeploymentTargetPostInstall(
      podfile,
      IOS_DEPLOYMENT_TARGET,
    );

    expect(result).toContain(
      "config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '16.4'",
    );
    expect(result).toContain('installer.pods_project.targets.each do |target|');
    expect(result).toContain('target.build_configurations.each do |config|');
  });

  it('does not duplicate the normalization when applied repeatedly', () => {
    const once = ensurePodfileDeploymentTargetPostInstall(
      podfile,
      IOS_DEPLOYMENT_TARGET,
    );
    const twice = ensurePodfileDeploymentTargetPostInstall(
      once,
      IOS_DEPLOYMENT_TARGET,
    );

    expect(twice).toBe(once);
    expect(
      twice.match(/Food Tracker deployment target normalization/g),
    ).toHaveLength(1);
  });

  it('rejects a Podfile without a post_install hook', () => {
    expect(() =>
      ensurePodfileDeploymentTargetPostInstall(
        "target 'FoodTracker' do\nend\n",
        IOS_DEPLOYMENT_TARGET,
      ),
    ).toThrow('post_install');
  });
});
