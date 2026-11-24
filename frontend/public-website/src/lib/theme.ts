/** Builds the CSS variables for the configurable theme (navy by default, purple or custom). */
const PRESETS: Record<string, string> = { navy: '#14254f', purple: '#4a1d5f' };
const DEFAULT_ACCENT = '#e89a1b';

const hex = (h: string): [number, number, number] => {
  const m = h.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  return m ? [parseInt(m[1]!, 16), parseInt(m[2]!, 16), parseInt(m[3]!, 16)] : [20, 37, 79];
};
const mix = (a: [number, number, number], b: [number, number, number], t: number) => a.map((v, i) => Math.round(v + (b[i]! - v) * t)) as [number, number, number];
const rgb = (c: [number, number, number]) => c.join(' ');

export function themeCss(theme: { preset?: string; primary?: string; accent?: string } | undefined) {
  const base = hex(theme?.preset === 'custom' && theme.primary ? theme.primary : PRESETS[theme?.preset ?? 'navy'] ?? PRESETS.navy!);
  const white: [number, number, number] = [255, 255, 255];
  const black: [number, number, number] = [0, 0, 0];
  // The supplied colour is the 800 shade (headings, buttons); lighter tints for backgrounds.
  const shades: Record<number, [number, number, number]> = {
    50: mix(base, white, 0.95),
    100: mix(base, white, 0.9),
    200: mix(base, white, 0.78),
    300: mix(base, white, 0.6),
    400: mix(base, white, 0.4),
    500: mix(base, white, 0.22),
    600: mix(base, white, 0.1),
    700: mix(base, white, 0.04),
    800: base,
    900: mix(base, black, 0.22),
    950: mix(base, black, 0.42),
  };
  const vars = Object.entries(shades).map(([k, v]) => `--p-${k}:${rgb(v)};`).join('');
  return `:root{${vars}--accent:${rgb(hex(theme?.accent || DEFAULT_ACCENT))};}`;
}
