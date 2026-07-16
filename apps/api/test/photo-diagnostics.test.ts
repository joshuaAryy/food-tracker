import { describe, expect, it } from 'vitest';
import {
  photoAnalysisDiagnosticDetails,
  runPhotoAnalysisWithId,
} from '../src/modules/ai/photo-diagnostics.js';

describe('photo analysis diagnostic correlation', () => {
  it('attaches only the request-scoped analysis identifier', () => {
    const details = runPhotoAnalysisWithId('analysis-test-id', () =>
      photoAnalysisDiagnosticDetails({ category: 'lifecycle' }),
    );

    expect(details).toEqual({
      analysisId: 'analysis-test-id',
      category: 'lifecycle',
    });
  });
});
