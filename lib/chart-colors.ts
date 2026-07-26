/**
 * Chart colors as CSS variable references.
 *
 * Recharts passes these straight through to SVG presentation attributes
 * (fill/stroke), where var() resolves normally — so the charts re-theme with
 * the rest of the app when [data-theme] flips. Do not resolve these to hex via
 * getComputedStyle: a snapshot would not react to a theme change.
 *
 * Values are defined in app/globals.css for both themes.
 */

/** Categorical palette for series with no inherent meaning (pie slices, etc.). */
export const CHART_SERIES = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
  "var(--chart-9)",
  "var(--chart-10)",
] as const;

/** Semantic colors for budget and income comparisons. */
export const CHART = {
  budgeted: "var(--interactive)",
  actual: "var(--success-solid)",
  over: "var(--accent-rose)",
  income: "var(--success-solid)",
  sales: "var(--interactive)",
} as const;

/** Pick a categorical color by index, wrapping around the palette. */
export function seriesColor(index: number): string {
  return CHART_SERIES[index % CHART_SERIES.length];
}
