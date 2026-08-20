export type MacroKey = 'protein' | 'carbs' | 'fat';

export const macroColors: Record<MacroKey, string> = {
  protein: '#C9242D',
  carbs: '#33B866',
  fat: '#FFAD8F',
};

type MacroSegment = {
  key: MacroKey;
  value: number;
  fraction: number;
};

export function macroDonutGeometry(size: number) {
  const radius = Math.round(size * 0.355);
  const strokeWidth = Math.round(size * 0.16);
  const centerRadius = Math.round(radius - strokeWidth / 2);
  const centerDiameter = centerRadius * 2;
  const centerOffset = (size - centerDiameter) / 2;

  return {
    radius,
    strokeWidth,
    centerRadius,
    centerDiameter,
    centerLabelBounds: {
      x: centerOffset,
      y: centerOffset,
      width: centerDiameter,
      height: centerDiameter,
    },
  };
}

export function macroSeparatorLines(
  segments: readonly MacroSegment[],
  size: number,
  radius: number,
  strokeWidth: number,
) {
  const center = size / 2;
  const innerRadius = radius - strokeWidth / 2 - 1;
  const outerRadius = radius + strokeWidth / 2;
  let fractionOffset = 0;

  return segments.flatMap((segment) => {
    if (segment.fraction <= 0) return [];
    const angle = -Math.PI / 2 + fractionOffset * Math.PI * 2;
    fractionOffset += segment.fraction;

    return [
      {
        x1: center + Math.cos(angle) * innerRadius,
        y1: center + Math.sin(angle) * innerRadius,
        x2: center + Math.cos(angle) * outerRadius,
        y2: center + Math.sin(angle) * outerRadius,
      },
    ];
  });
}

export function macroSegments(
  values: Record<MacroKey, number | null>,
): MacroSegment[] {
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
