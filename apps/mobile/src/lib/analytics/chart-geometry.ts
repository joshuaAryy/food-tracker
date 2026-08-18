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

/**
 * Insets selection-only decoration so its stroke remains visible at the plot
 * boundary without altering the fixed x-domain used by raw chart values.
 */
export function selectionDecorationX(
  index: number,
  count: number,
  width: number,
  edgeInset: number,
): number {
  const safeWidth = Math.max(width, 0);
  const safeInset = Math.min(Math.max(edgeInset, 0), safeWidth / 2);
  return Math.min(
    Math.max(pointX(index, count, width), safeInset),
    safeWidth - safeInset,
  );
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

function smoothSegmentPath(
  points: readonly { x: number; y: number }[],
): string {
  if (points.length === 0) return '';
  const first = points[0];
  if (first === undefined) return '';
  if (points.length === 1) {
    return `M ${coordinate(first.x)} ${coordinate(first.y)}`;
  }

  const secants = points.slice(0, -1).map((point, index) => {
    const next = points[index + 1]!;
    return (next.y - point.y) / (next.x - point.x);
  });
  const tangents = points.map((_, index) => {
    if (index === 0) return secants[0]!;
    if (index === points.length - 1) return secants.at(-1)!;
    const previous = secants[index - 1]!;
    const next = secants[index]!;
    if (
      previous === 0 ||
      next === 0 ||
      Math.sign(previous) !== Math.sign(next)
    ) {
      return 0;
    }
    return (2 * previous * next) / (previous + next);
  });
  const commands = [`M ${coordinate(first.x)} ${coordinate(first.y)}`];
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]!;
    const end = points[index + 1]!;
    const distance = end.x - start.x;
    const control1 = {
      x: start.x + distance / 3,
      y: start.y + (tangents[index]! * distance) / 3,
    };
    const control2 = {
      x: end.x - distance / 3,
      y: end.y - (tangents[index + 1]! * distance) / 3,
    };
    commands.push(
      `C ${coordinate(control1.x)} ${coordinate(control1.y)} ${coordinate(control2.x)} ${coordinate(control2.y)} ${coordinate(end.x)} ${coordinate(end.y)}`,
    );
  }
  return commands.join(' ');
}

/**
 * Draws values against their fixed timeline. Derived trend layers may bridge
 * gaps without manufacturing raw observations; raw daily layers should retain
 * the default segmented behavior.
 */
export function smoothLinePath(
  values: readonly (number | null)[],
  domain: ChartDomain,
  size: ChartSize,
  options: { connectGaps?: boolean } = {},
): string {
  if (options.connectGaps === true) {
    const points = values.flatMap((value, index) =>
      value === null || !Number.isFinite(value)
        ? []
        : [
            {
              x: pointX(index, values.length, size.width),
              y: pointY(value, domain, size.height),
            },
          ],
    );
    return smoothSegmentPath(points);
  }

  const segments: string[] = [];
  let segment: { x: number; y: number }[] = [];
  const flush = () => {
    if (segment.length > 0) segments.push(smoothSegmentPath(segment));
    segment = [];
  };

  values.forEach((value, index) => {
    if (value === null || !Number.isFinite(value)) {
      flush();
      return;
    }
    segment.push({
      x: pointX(index, values.length, size.width),
      y: pointY(value, domain, size.height),
    });
  });
  flush();
  return segments.join(' ');
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

export interface ChartBarRect {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Draws a bar with a softened value-facing cap and a square baseline edge.
 * Keeping the baseline edge square avoids the inflated pill/slab look when
 * columns meet the zero line.
 */
export function roundedBarPath(bar: ChartBarRect, radius = 4): string {
  const left = bar.x;
  const top = bar.y;
  const right = bar.x + bar.width;
  const bottom = bar.y + bar.height;
  const safeRadius = Math.min(
    Math.max(radius, 0),
    bar.width / 2,
    bar.height / 2,
  );

  if (safeRadius === 0) {
    return `M ${coordinate(left)} ${coordinate(top)} L ${coordinate(right)} ${coordinate(top)} L ${coordinate(right)} ${coordinate(bottom)} L ${coordinate(left)} ${coordinate(bottom)} Z`;
  }

  return [
    `M ${coordinate(left + safeRadius)} ${coordinate(top)}`,
    `Q ${coordinate(left)} ${coordinate(top)} ${coordinate(left)} ${coordinate(top + safeRadius)}`,
    `L ${coordinate(left)} ${coordinate(bottom)}`,
    `L ${coordinate(right)} ${coordinate(bottom)}`,
    `L ${coordinate(right)} ${coordinate(top + safeRadius)}`,
    `Q ${coordinate(right)} ${coordinate(top)} ${coordinate(right - safeRadius)} ${coordinate(top)}`,
    'Z',
  ].join(' ');
}

export function barRects(
  values: readonly (number | null)[],
  domain: ChartDomain,
  size: ChartSize,
): ChartBarRect[] {
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
