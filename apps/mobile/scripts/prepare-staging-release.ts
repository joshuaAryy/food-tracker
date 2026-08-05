import {
  assertReleaseBundleArtifact,
  cleanupGeneratedIosDirectory,
  findNewestReleaseArtifact,
  loadValidatedStagingReleaseConfig,
  resolveWorkflowPaths,
  runStagingReleasePreparation,
} from './staging-release-workflow';

function main(): void {
  const cleanup = process.argv.includes('--cleanup-after-validation');
  const verifyArtifact = process.argv.includes('--verify-release-artifact');
  const paths = resolveWorkflowPaths();
  if (cleanup) {
    cleanupGeneratedIosDirectory(paths.rootDir);
    console.log(
      'Removed only the ignored generated apps/mobile/ios directory.',
    );
    return;
  }

  if (verifyArtifact) {
    const config = loadValidatedStagingReleaseConfig(paths.envFilePath);
    const artifact = findNewestReleaseArtifact();
    assertReleaseBundleArtifact(artifact, config);
    console.log('Release artifact found.');
    console.log('JavaScript bundle is non-empty.');
    console.log('Embedded API target is the validated Railway staging target.');
    console.log('Embedded environment is staging.');
    console.log('Release metadata is canonical.');
    return;
  }

  const config = runStagingReleasePreparation({
    rootDir: paths.rootDir,
    envFilePath: paths.envFilePath,
  });
  console.log(
    'Staging Release preparation passed. Xcode workspace opened for Personal Team signing.',
  );
  console.log(JSON.stringify(config.sanitized, null, 2));
}

try {
  main();
} catch (error) {
  const message =
    error instanceof Error ? error.message : 'unknown workflow failure';
  console.error(`Phase 17 staging Release preparation failed: ${message}`);
  process.exitCode = 1;
}
