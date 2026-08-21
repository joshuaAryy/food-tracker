import type { ChartDomain } from './chart-domain';

export function referenceBand(
  range: { lower: number; upper: number } | null,
  domain: ChartDomain,
  height: number,
): { y: number; height: number } | null {
  if (
    range === null ||
    !Number.isFinite(range.lower) ||
    !Number.isFinite(range.upper)
  )
    return null;
  if (range.lower >= range.upper || domain.min === domain.max) return null;
  const yFor = (value: number) =>
    height - ((value - domain.min) / (domain.max - domain.min)) * height;
  const upperY = yFor(range.upper);
  const lowerY = yFor(range.lower);
  return { y: Math.min(upperY, lowerY), height: Math.abs(lowerY - upperY) };
}
