import { Router, type RequestHandler } from 'express';
import {
  idParamsSchema,
  recipeCreateInputSchema,
  recipeIngredientInputSchema,
  recipeLogInputSchema,
  recipeUpdateInputSchema,
} from '@food-tracker/shared';
import { z } from 'zod';
import { currentUserId } from '../../lib/auth.js';
import { sendSuccess } from '../../lib/responses.js';
import { serializeFoodLog } from '../../lib/serializers.js';
import {
  validateBody,
  validateParams,
  validatedBody,
  validatedParams,
} from '../../middleware/validate.js';
import { AppError } from '../../lib/errors.js';
import {
  addRecipeIngredient,
  archiveRecipe,
  createRecipe,
  deleteRecipeIngredient,
  getRecipe,
  listRecipes,
  logRecipe,
  updateRecipe,
  updateRecipeIngredient,
} from './service.js';

const ingredientParamsSchema = z.strictObject({
  id: z.uuid(),
  ingredientId: z.uuid(),
});

export const recipesRouter = Router();

const validateRecipeBody =
  (schema: z.ZodType): RequestHandler =>
  (request, response, next) => {
    const result = schema.safeParse(request.body);
    if (result.success) {
      response.locals.validated = {
        ...(response.locals.validated as Record<string, unknown> | undefined),
        body: result.data,
      };
      next();
      return;
    }
    const servingIssue = result.error.issues.find((issue) =>
      issue.path.some((segment) => segment === 'serving'),
    );
    if (servingIssue !== undefined) {
      next(
        new AppError(
          400,
          'INVALID_SERVING_REQUEST',
          'The requested serving is invalid.',
        ),
      );
      return;
    }
    next(
      new AppError(
        400,
        'VALIDATION_ERROR',
        result.error.issues[0]?.message ?? 'Request validation failed',
        { issues: result.error.issues },
      ),
    );
  };

recipesRouter.get('/', async (_request, response) => {
  sendSuccess(response, {
    recipes: await listRecipes(currentUserId(response)),
  });
});

recipesRouter.post(
  '/',
  validateRecipeBody(recipeCreateInputSchema),
  async (_request, response) => {
    sendSuccess(
      response,
      await createRecipe(validatedBody(response), currentUserId(response)),
    );
  },
);

recipesRouter.post(
  '/:id/log',
  validateParams(idParamsSchema),
  validateBody(recipeLogInputSchema),
  async (_request, response) => {
    sendSuccess(
      response,
      serializeFoodLog(
        await logRecipe(
          validatedParams<{ id: string }>(response).id,
          validatedBody(response),
          currentUserId(response),
        ),
      ),
    );
  },
);

recipesRouter.get(
  '/:id',
  validateParams(idParamsSchema),
  async (_request, response) => {
    sendSuccess(
      response,
      await getRecipe(
        validatedParams<{ id: string }>(response).id,
        currentUserId(response),
      ),
    );
  },
);

recipesRouter.put(
  '/:id',
  validateParams(idParamsSchema),
  validateBody(recipeUpdateInputSchema),
  async (_request, response) => {
    sendSuccess(
      response,
      await updateRecipe(
        validatedParams<{ id: string }>(response).id,
        validatedBody(response),
        currentUserId(response),
      ),
    );
  },
);

recipesRouter.delete(
  '/:id',
  validateParams(idParamsSchema),
  async (_request, response) => {
    const id = validatedParams<{ id: string }>(response).id;
    await archiveRecipe(id, currentUserId(response));
    sendSuccess(response, { id, archived: true });
  },
);

recipesRouter.post(
  '/:id/ingredients',
  validateParams(idParamsSchema),
  validateRecipeBody(recipeIngredientInputSchema),
  async (_request, response) => {
    sendSuccess(
      response,
      await addRecipeIngredient(
        validatedParams<{ id: string }>(response).id,
        validatedBody(response),
        currentUserId(response),
      ),
    );
  },
);

recipesRouter.put(
  '/:id/ingredients/:ingredientId',
  validateParams(ingredientParamsSchema),
  validateRecipeBody(recipeIngredientInputSchema),
  async (_request, response) => {
    const params = validatedParams<{ id: string; ingredientId: string }>(
      response,
    );
    sendSuccess(
      response,
      await updateRecipeIngredient(
        params.id,
        params.ingredientId,
        validatedBody(response),
        currentUserId(response),
      ),
    );
  },
);

recipesRouter.delete(
  '/:id/ingredients/:ingredientId',
  validateParams(ingredientParamsSchema),
  async (_request, response) => {
    const params = validatedParams<{ id: string; ingredientId: string }>(
      response,
    );
    sendSuccess(
      response,
      await deleteRecipeIngredient(
        params.id,
        params.ingredientId,
        currentUserId(response),
      ),
    );
  },
);
