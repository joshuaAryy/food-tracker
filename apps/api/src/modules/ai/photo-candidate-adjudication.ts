import {
  photoConfidenceLevelSchema,
  type PhotoConfidenceLevel,
  type PhotoProvisionalQuantity,
  type PhotoRepresentationKind,
  type PhotoNutritionEstimateBasis,
} from '@food-tracker/shared';
import { z } from 'zod';
import type { PhotoAnalysisConfig } from './photo-config.js';
import {
  validatePhotoNutritionEstimate,
  type PhotoNutritionEstimateValues,
} from './photo-nutrition-estimate.js';

export interface PhotoAdjudicationCandidateSummary {
  candidateRef: string;
  displayName: string;
  brandName: string | null;
  preparationForm: string | null;
  foodType: 'generic' | 'branded';
  source: string;
  servingLabels: string[];
}

export interface PhotoAdjudicationRow {
  recognitionRef: string;
  recognizedName: string;
  preparationForm: string | null;
  quantity: PhotoProvisionalQuantity;
  estimateBasis: PhotoNutritionEstimateBasis;
  representationKind: PhotoRepresentationKind;
  coverage: string[];
  visiblePortionDescription: string | null;
  candidates: PhotoAdjudicationCandidateSummary[];
}

export interface PhotoAdjudicationRequest {
  rows: PhotoAdjudicationRow[];
}

export type PhotoAdjudicationDecision =
  | {
      recognitionRef: string;
      decision: 'select_candidate';
      candidateRef: string;
      confidence: PhotoConfidenceLevel;
      nutritionEstimate?: PhotoNutritionEstimateValues;
    }
  | {
      recognitionRef: string;
      decision: 'reject_all';
      confidence: PhotoConfidenceLevel;
      nutritionEstimate?: PhotoNutritionEstimateValues;
    }
  | {
      recognitionRef: string;
      decision: 'no_decision';
      nutritionEstimate?: PhotoNutritionEstimateValues;
    };

export type PhotoAdjudicationResult =
  | { status: 'completed'; decisions: PhotoAdjudicationDecision[] }
  | { status: 'unavailable'; decisions: [] }
  | { status: 'invalid_response'; decisions: [] };

export interface PhotoCandidateAdjudicationProvider {
  adjudicate(input: {
    request: PhotoAdjudicationRequest;
    signal: AbortSignal;
  }): Promise<PhotoAdjudicationResult>;
}

const rawDecisionSchema = z.strictObject({
  recognitionRef: z.string().trim().min(1).max(80),
  decision: z.enum(['select_candidate', 'reject_all', 'no_decision']),
  candidateRef: z.string().trim().min(1).max(80).nullable().default(null),
  confidence: photoConfidenceLevelSchema.nullable().default(null),
  nutritionEstimate: z
    .strictObject({
      calories: z.number().finite(),
      proteinGrams: z.number().finite().nonnegative(),
      carbohydrateGrams: z.number().finite().nonnegative(),
      fatGrams: z.number().finite().nonnegative(),
      confidence: z.enum(['low', 'medium']),
    })
    .nullable()
    .default(null),
});

const rawOutputSchema = z.strictObject({
  decisions: z.array(rawDecisionSchema).max(8),
});

const geminiResponseSchema = {
  type: 'object',
  properties: {
    decisions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          recognitionRef: { type: 'string' },
          decision: {
            type: 'string',
            enum: ['select_candidate', 'reject_all', 'no_decision'],
          },
          candidateRef: { type: 'string', nullable: true },
          confidence: {
            type: 'string',
            enum: ['high', 'medium', 'low'],
            nullable: true,
          },
          nutritionEstimate: {
            type: 'object',
            properties: {
              calories: { type: 'number' },
              proteinGrams: { type: 'number' },
              carbohydrateGrams: { type: 'number' },
              fatGrams: { type: 'number' },
              confidence: { type: 'string', enum: ['low', 'medium'] },
            },
            required: [
              'calories',
              'proteinGrams',
              'carbohydrateGrams',
              'fatGrams',
              'confidence',
            ],
          },
        },
        required: ['recognitionRef', 'decision'],
      },
    },
  },
  required: ['decisions'],
} as const;

function logDiagnostic(category: string, details: Record<string, unknown>) {
  console.warn('[photo-adjudication:provider]', { category, ...details });
}

function isThoughtPart(part: Record<string, unknown>): boolean {
  // Gemini may attach a thoughtSignature to the final text part as well as
  // to explicit thought parts. Only explicit thought content is excluded;
  // signed final JSON remains provider output that must be parsed.
  return (
    part.thought === true ||
    (part.thoughtSignature !== undefined && typeof part.text !== 'string')
  );
}

function assembledText(payload: {
  candidates?: { content?: { parts?: unknown }; finishReason?: unknown }[];
}): { text: string; finishReason: unknown } {
  const candidate = payload.candidates?.[0];
  const parts = Array.isArray(candidate?.content?.parts)
    ? candidate.content.parts.filter(
        (part): part is Record<string, unknown> =>
          typeof part === 'object' && part !== null,
      )
    : [];
  return {
    text: parts
      .filter((part) => !isThoughtPart(part))
      .map((part) => (typeof part.text === 'string' ? part.text : ''))
      .join(''),
    finishReason: candidate?.finishReason,
  };
}

function parseDecisions(
  text: string,
  request: PhotoAdjudicationRequest,
  estimateRequired: boolean,
): PhotoAdjudicationDecision[] | null {
  let decoded: unknown;
  try {
    decoded = JSON.parse(text.trim());
  } catch {
    return null;
  }

  const parsed = rawOutputSchema.safeParse(decoded);
  if (!parsed.success) return null;

  const rows = new Map(
    request.rows.map((row) => [
      row.recognitionRef,
      new Set(row.candidates.map((candidate) => candidate.candidateRef)),
    ]),
  );
  const seen = new Set<string>();
  const decisions: PhotoAdjudicationDecision[] = [];

  for (const decision of parsed.data.decisions) {
    const candidateRefs = rows.get(decision.recognitionRef);
    if (candidateRefs === undefined || seen.has(decision.recognitionRef)) {
      return null;
    }
    seen.add(decision.recognitionRef);
    const estimate =
      decision.nutritionEstimate === null
        ? undefined
        : (validatePhotoNutritionEstimate(decision.nutritionEstimate) ??
          undefined);
    if (decision.nutritionEstimate !== null && estimate === undefined) {
      logDiagnostic('provider_optional_nutrition_estimate_discarded', {
        rowCount: request.rows.length,
        recognitionRef: decision.recognitionRef,
      });
    }
    if (estimateRequired && decision.nutritionEstimate === null) {
      logDiagnostic('provider_nutrition_estimate_missing', {
        rowCount: request.rows.length,
        recognitionRef: decision.recognitionRef,
      });
    }

    if (decision.decision === 'select_candidate') {
      if (
        decision.candidateRef === null ||
        decision.confidence === null ||
        !candidateRefs.has(decision.candidateRef)
      ) {
        return null;
      }
      decisions.push({
        recognitionRef: decision.recognitionRef,
        decision: decision.decision,
        candidateRef: decision.candidateRef,
        confidence: decision.confidence,
        ...(estimate === undefined ? {} : { nutritionEstimate: estimate }),
      });
      continue;
    }

    if (decision.decision === 'reject_all') {
      if (decision.candidateRef !== null || decision.confidence === null) {
        return null;
      }
      decisions.push({
        recognitionRef: decision.recognitionRef,
        decision: decision.decision,
        confidence: decision.confidence,
        ...(estimate === undefined ? {} : { nutritionEstimate: estimate }),
      });
      continue;
    }

    if (decision.candidateRef !== null || decision.confidence !== null) {
      return null;
    }
    decisions.push({
      recognitionRef: decision.recognitionRef,
      decision: decision.decision,
      ...(estimate === undefined ? {} : { nutritionEstimate: estimate }),
    });
  }

  return decisions;
}

function requestText(request: PhotoAdjudicationRequest): string {
  return [
    'Resolve ambiguous photo-recognition rows and provide low-trust nutrition estimates only when requested context is sufficient.',
    'Use only the supplied candidateRef values. Do not create candidates.',
    'Return JSON only. Nutrition estimates may contain only calories, proteinGrams, carbohydrateGrams, fatGrams, and low or medium confidence.',
    'Do not include micronutrients, serving weights, serving conversions, rewritten food names, reasoning, or database IDs.',
    'Every requested row must receive exactly one decision. select_candidate and reject_all require confidence; no_decision must omit candidateRef and confidence. reject_all requires confidence.',
    'candidate-less rows must use no_decision, never reject_all. Every requested row must include nutritionEstimate with all five required fields; do not omit it when estimateBasis is present.',
    'Use select_candidate only with high confidence when one candidate clearly represents the recognition.',
    'Use reject_all when every supplied candidate is clearly unsuitable. Otherwise use no_decision.',
    JSON.stringify({ rows: request.rows }),
  ].join('\n');
}

class GeminiPhotoCandidateAdjudicationProvider implements PhotoCandidateAdjudicationProvider {
  constructor(private readonly config: PhotoAdjudicationConfig) {}

  async adjudicate(input: {
    request: PhotoAdjudicationRequest;
    signal: AbortSignal;
  }): Promise<PhotoAdjudicationResult> {
    if (this.config.geminiApiKey === null) {
      return { status: 'unavailable', decisions: [] };
    }

    const controller = new AbortController();
    const abortFromCaller = () => controller.abort();
    if (input.signal.aborted) controller.abort();
    input.signal.addEventListener('abort', abortFromCaller, { once: true });
    const timeout = setTimeout(() => controller.abort(), this.config.timeoutMs);

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          this.config.geminiModel,
        )}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.config.geminiApiKey,
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: requestText(input.request) }] }],
            generationConfig: {
              candidateCount: 1,
              thinkingConfig: { thinkingBudget: 0 },
              temperature: 0.1,
              maxOutputTokens: this.config.maxOutputTokens,
              responseMimeType: 'application/json',
              responseSchema: geminiResponseSchema,
            },
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        logDiagnostic('upstream_failure', {
          status: response.status,
          rowCount: input.request.rows.length,
          candidateCount: input.request.rows.reduce(
            (count, row) => count + row.candidates.length,
            0,
          ),
        });
        return { status: 'unavailable', decisions: [] };
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        logDiagnostic('malformed_provider_json', {
          rowCount: input.request.rows.length,
        });
        return { status: 'invalid_response', decisions: [] };
      }

      const completed = assembledText(
        payload as {
          candidates?: {
            content?: { parts?: unknown };
            finishReason?: unknown;
          }[];
        },
      );
      if (completed.finishReason !== 'STOP') {
        logDiagnostic('provider_completion_failure', {
          finishReason: completed.finishReason,
          rowCount: input.request.rows.length,
        });
        return { status: 'unavailable', decisions: [] };
      }

      const decisions = parseDecisions(
        completed.text,
        input.request,
        this.config.nutritionEstimationEnabled,
      );
      if (decisions === null) {
        logDiagnostic('invalid_decision_response', {
          rowCount: input.request.rows.length,
        });
        return { status: 'invalid_response', decisions: [] };
      }
      return { status: 'completed', decisions };
    } catch (error) {
      logDiagnostic('request_failure', {
        aborted:
          (error instanceof DOMException && error.name === 'AbortError') ||
          (error instanceof Error && error.name === 'AbortError'),
        rowCount: input.request.rows.length,
      });
      return { status: 'unavailable', decisions: [] };
    } finally {
      clearTimeout(timeout);
      input.signal.removeEventListener('abort', abortFromCaller);
    }
  }
}

class MockPhotoCandidateAdjudicationProvider implements PhotoCandidateAdjudicationProvider {
  constructor(private readonly config: PhotoAdjudicationConfig) {}

  private estimate() {
    if (!this.config.nutritionEstimationEnabled) return undefined;
    if (this.config.nutritionEstimationMock === 'missing') return undefined;
    if (this.config.nutritionEstimationMock === 'invalid') {
      return {
        calories: 50,
        proteinGrams: 100,
        carbohydrateGrams: 100,
        fatGrams: 100,
        confidence: 'low' as const,
      };
    }
    return {
      calories: 460,
      proteinGrams: 15.3,
      carbohydrateGrams: 76.1,
      fatGrams: 11,
      confidence: 'low' as const,
    };
  }

  async adjudicate(input: {
    request: PhotoAdjudicationRequest;
  }): Promise<PhotoAdjudicationResult> {
    if (
      this.config.mockDecision === 'unavailable' ||
      this.config.nutritionEstimationMock === 'unavailable'
    ) {
      return { status: 'unavailable', decisions: [] };
    }
    if (this.config.mockDecision === 'no_decision') {
      return {
        status: 'completed',
        decisions: input.request.rows.map((row) => {
          const nutritionEstimate = this.estimate();
          return {
            recognitionRef: row.recognitionRef,
            decision: 'no_decision' as const,
            ...(nutritionEstimate === undefined ? {} : { nutritionEstimate }),
          };
        }),
      };
    }
    if (this.config.mockDecision === 'reject_all') {
      return {
        status: 'completed',
        decisions: input.request.rows.map((row) => {
          const nutritionEstimate = this.estimate();
          return {
            recognitionRef: row.recognitionRef,
            decision: 'reject_all' as const,
            confidence: 'high' as const,
            ...(nutritionEstimate === undefined ? {} : { nutritionEstimate }),
          };
        }),
      };
    }
    return {
      status: 'completed',
      decisions: input.request.rows.map((row) => {
        const nutritionEstimate = this.estimate();
        if (row.candidates.length === 0) {
          return {
            recognitionRef: row.recognitionRef,
            decision: 'no_decision' as const,
            ...(nutritionEstimate === undefined ? {} : { nutritionEstimate }),
          };
        }
        return {
          recognitionRef: row.recognitionRef,
          decision: 'select_candidate' as const,
          candidateRef: row.candidates[0]?.candidateRef ?? '',
          confidence: 'high' as const,
          ...(nutritionEstimate === undefined ? {} : { nutritionEstimate }),
        };
      }),
    };
  }
}

class DisabledPhotoCandidateAdjudicationProvider implements PhotoCandidateAdjudicationProvider {
  async adjudicate(): Promise<PhotoAdjudicationResult> {
    return { status: 'unavailable', decisions: [] };
  }
}

export function photoCandidateAdjudicationProvider(
  config: PhotoAdjudicationConfig,
): PhotoCandidateAdjudicationProvider {
  if (config.provider === 'gemini') {
    return new GeminiPhotoCandidateAdjudicationProvider(config);
  }
  if (config.provider === 'mock') {
    return new MockPhotoCandidateAdjudicationProvider(config);
  }
  return new DisabledPhotoCandidateAdjudicationProvider();
}

export interface PhotoAdjudicationConfig {
  provider: PhotoAnalysisConfig['provider'];
  geminiApiKey: string | null;
  geminiModel: string;
  timeoutMs: number;
  maxOutputTokens: number;
  maxCandidates: number;
  maxRows: number;
  mockDecision: PhotoAnalysisConfig['candidateAdjudicationMockDecision'];
  nutritionEstimationEnabled: boolean;
  nutritionEstimationMock: PhotoAnalysisConfig['nutritionEstimationMock'];
}
