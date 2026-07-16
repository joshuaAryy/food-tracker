import { AsyncLocalStorage } from 'node:async_hooks';

const analysisContext = new AsyncLocalStorage<string>();

export function runPhotoAnalysisWithId<T>(
  analysisId: string,
  callback: () => T,
): T {
  return analysisContext.run(analysisId, callback);
}

export function photoAnalysisDiagnosticDetails(
  details: Record<string, unknown>,
): Record<string, unknown> {
  const analysisId = analysisContext.getStore();
  return analysisId === undefined ? details : { analysisId, ...details };
}
