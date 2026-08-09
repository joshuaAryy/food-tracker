import type { ChartDomain } from './chart-domain';

export interface ChartSize {
  width: number;
  height: number;
}

export function clampScrubX(position: number, width: number): number {
  return Math.min(Math.max(position, 0), Math.max(width, 0));
}

export function decimateLabelIndexes(
  pointCount: number,
  maximumLabels: number,
): number[] {
  if (pointCount <= 0 || maximumLabels <= 0) return [];
  if (pointCount <= maximumLabels)
    return Array.from({ length: pointCount }, (_, index) => index);
  const lastIndex = pointCount - 1;
  const step = lastIndex / (maximumLabels - 1);
  return Array.from({ length: maximumLabels }, (_, index) =>
    index === maximumLabels - 1 ? lastIndex : Math.round(index * step),
  );
}

export function pointY(
  value: number,
  domain: ChartDomain,
  height: number,
): number {
  if (domain.max === domain.min) return height / 2;
  return height - ((value - domain.min) / (domain.max - domain.min)) * height;
}

export function pointX(index: number, count: number, width: number): number {
  return count <= 1 ? width / 2 : (index / (count - 1)) * width;
}

function coordinate(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function linePath(
  values: readonly (number | null)[],
  domain: ChartDomain,
  size: ChartSize,
): string {
  let previousWasGap = true;
  return values
    .flatMap((value, index) => {
      if (value === null || !Number.isFinite(value)) {
        previousWasGap = true;
        return [];
      }
      const command = previousWasGap ? 'M' : 'L';
      previousWasGap = false;
      return [
        `${command} ${coordinate(pointX(index, values.length, size.width))} ${coordinate(
          pointY(value, domain, size.height),
        )}`,
      ];
    })
    .join(' ');
}

/**
 * Keeps the dotted projection on the same fixed timeline as history and joins
 * it to the last known historical point without manufacturing a missing value.
 */
export function forecastPathWithContinuity(
  historical: readonly (number | null)[],
  forecast: readonly number[],
  domain: ChartDomain,
  size: ChartSize,
): string {
  const historicalIndex = historical.reduce<number>(
    (latestIndex, value, index) =>
      value !== null && Number.isFinite(value) ? index : latestIndex,
    -1,
  );
  if (historicalIndex < 0 || forecast.length === 0) return '';

  const values = Array<number | null>(historical.length + forecast.length).fill(
    null,
  );
  values[historicalIndex] = historical[historicalIndex] ?? null;
  forecast.forEach((value, index) => {
    values[historical.length + index] = value;
  });
  return linePath(values, domain, size);
}

export function barRects(
  values: readonly (number | null)[],
  domain: ChartDomain,
  size: ChartSize,
): { index: number; x: number; y: number; width: number; height: number }[] {
  const slotWidth = size.width / Math.max(values.length, 1);
  const width = slotWidth * 0.8;
  const baseline = pointY(0, domain, size.height);
  return values.flatMap((value, index) => {
    if (value === null || !Number.isFinite(value)) return [];
    const y = pointY(value, domain, size.height);
    return [
      {
        index,
        x: coordinate(index * slotWidth + (slotWidth - width) / 2),
        y: coordinate(Math.min(y, baseline)),
        width: coordinate(width),
        height: coordinate(Math.abs(baseline - y)),
      },
    ];
  });
}

export function referenceLineY(
  reference: number,
  domain: ChartDomain,
  height: number,
): number {
  return pointY(reference, domain, height);
}

export function uncertaintyPolygon(
  points: readonly { value: number; lower: number; upper: number }[],
  domain: ChartDomain,
  size: ChartSize,
): string {
  const upper = points.map(
    (point, index) =>
      `${coordinate(pointX(index, points.length, size.width))},${coordinate(
        pointY(point.upper, domain, size.height),
      )}`,
  );
  const lower = [...points].reverse().map((point, reverseIndex) => {
    const index = points.length - reverseIndex - 1;
    return `${coordinate(pointX(index, points.length, size.width))},${coordinate(
      pointY(point.lower, domain, size.height),
    )}`;
  });
  return [...upper, ...lower].join(' ');
}

export function uncertaintyPolygonAtOffset(
  points: readonly { value: number; lower: number; upper: number }[],
  domain: ChartDomain,
  size: ChartSize,
  offset: { startIndex: number; totalPointCount: number },
): string {
  const xAt = (index: number) =>
    coordinate(
      pointX(offset.startIndex + index, offset.totalPointCount, size.width),
    );
  const upper = points.map(
    (point, index) =>
      `${xAt(index)},${coordinate(pointY(point.upper, domain, size.height))}`,
  );
  const lower = [...points].reverse().map((point, reverseIndex) => {
    const index = points.length - reverseIndex - 1;
    return `${xAt(index)},${coordinate(pointY(point.lower, domain, size.height))}`;
  });
  return [...upper, ...lower].join(' ');
}
