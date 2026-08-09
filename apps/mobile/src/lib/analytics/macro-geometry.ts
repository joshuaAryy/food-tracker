export type MacroKey = 'protein' | 'carbs' | 'fat';

export function macroSegments(values: Record<MacroKey, number | null>): {
  key: MacroKey;
  value: number;
  fraction: number;
}[] {
  const known = (Object.keys(values) as MacroKey[]).flatMap((key) => {
    const value = values[key];
    return value === null || !Number.isFinite(value) ? [] : [{ key, value }];
  });
  const total = known.reduce((sum, segment) => sum + segment.value, 0);
  return known.map((segment) => ({
    ...segment,
    fraction: total === 0 ? 0 : segment.value / total,
  }));
}

export function stackedMacroSegments(values: Record<MacroKey, number | null>): {
  key: MacroKey;
  value: number;
  start: number;
  end: number;
}[] {
  let runningTotal = 0;
  return (Object.keys(values) as MacroKey[]).flatMap((key) => {
    const value = values[key];
    if (value === null || !Number.isFinite(value)) return [];
    const segment = {
      key,
      value,
      start: runningTotal,
      end: runningTotal + value,
    };
    runningTotal += value;
    return [segment];
  });
}
