import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type IntegerValue = string | number | bigint | null | undefined;

export function normalizeIntegerValue(value: IntegerValue): string {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return '0';
    return Math.trunc(value).toString();
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return /^-?\d+$/.test(trimmed) ? trimmed : '0';
  }

  return '0';
}

export function toBigIntSafe(value: IntegerValue): bigint {
  return BigInt(normalizeIntegerValue(value));
}

export function addIntegerValues(...values: IntegerValue[]): string {
  return values
    .map((value) => toBigIntSafe(value))
    .reduce((total, current) => total + current, 0n)
    .toString();
}

export function subtractIntegerValues(a: IntegerValue, b: IntegerValue): string {
  return (toBigIntSafe(a) - toBigIntSafe(b)).toString();
}

export function compareIntegerValues(a: IntegerValue, b: IntegerValue): number {
  const left = toBigIntSafe(a);
  const right = toBigIntSafe(b);

  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

export function calculatePercentage(
  numerator: IntegerValue,
  denominator: IntegerValue,
  precision = 1,
): number {
  const top = toBigIntSafe(numerator);
  const bottom = toBigIntSafe(denominator);

  if (bottom <= 0n) return 0;

  const scale = 10n ** BigInt(Math.max(0, precision));
  const scaledPercent = (top * 100n * scale) / bottom;
  return Number(scaledPercent) / Number(scale);
}

export function formatIntegerValue(value: IntegerValue): string {
  const normalized = normalizeIntegerValue(value);
  const sign = normalized.startsWith('-') ? '-' : '';
  const digits = sign ? normalized.slice(1) : normalized;

  return `${sign}${digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

export function formatIntegerWithUnit(
  value: IntegerValue,
  unit = 'wei',
): string {
  return `${formatIntegerValue(value)} ${unit}`;
}
