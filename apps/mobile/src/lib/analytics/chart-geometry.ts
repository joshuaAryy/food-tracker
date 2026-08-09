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

function yFor(value: number, domain: ChartDomain, height: number): number {
  if (domain.max === domain.min) return height / 2;
  return height - ((value - domain.min) / (domain.max - domain.min)) * height;
}

function xFor(index: number, count: number, width: number): number {
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
        `${command} ${coordinate(xFor(index, values.length, size.width))} ${coordinate(
          yFor(value, domain, size.height),
        )}`,
      ];
    })
    .join(' ');
}

export function barRects(
  values: readonly (number | null)[],
  domain: ChartDomain,
  size: ChartSize,
): { index: number; x: number; y: number; width: number; height: number }[] {
  const slotWidth = size.width / Math.max(values.length, 1);
  const width = slotWidth * 0.8;
  const baseline = yFor(0, domain, size.height);
  return values.flatMap((value, index) => {
    if (value === null || !Number.isFinite(value)) return [];
    const y = yFor(value, domain, size.height);
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
  return yFor(reference, domain, height);
}

export function uncertaintyPolygon(
  points: readonly { value: number; lower: number; upper: number }[],
  domain: ChartDomain,
  size: ChartSize,
): string {
  const upper = points.map(
    (point, index) =>
      `${coordinate(xFor(index, points.length, size.width))},${coordinate(
        yFor(point.upper, domain, size.height),
      )}`,
  );
  const lower = [...points].reverse().map((point, reverseIndex) => {
    const index = points.length - reverseIndex - 1;
    return `${coordinate(xFor(index, points.length, size.width))},${coordinate(
      yFor(point.lower, domain, size.height),
    )}`;
  });
  return [...upper, ...lower].join(' ');
}
