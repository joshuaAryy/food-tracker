-- Preserve the historical pace intent for existing adult goals while allowing
-- the resolver to treat the numeric rate as the canonical planning input.
UPDATE "UserGoal"
SET "targetRateLbPerWeek" = CASE "goalPace"
  WHEN 'slow' THEN 0.50
  WHEN 'moderate' THEN 1.00
  WHEN 'aggressive' THEN 1.50
  WHEN 'lean_bulk' THEN 0.50
  WHEN 'moderate_bulk' THEN 0.75
  WHEN 'aggressive_bulk' THEN 1.00
  ELSE NULL
END
WHERE "targetRateLbPerWeek" IS NULL;
