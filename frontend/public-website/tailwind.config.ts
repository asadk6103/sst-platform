import type { Config } from 'tailwindcss';

// Theme colours come from CSS variables generated from the admin-selected theme
// (src/lib/theme.ts), so the colour scheme is configurable without changing layouts.
const shade = (n: number | string) => `rgb(var(--p-${n}) / <alpha-value>)`;
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: Object.fromEntries([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950].map((n) => [n, shade(n)])),
        gold: { 100: '#fdf1d8', 300: '#f7c95c', 400: '#f2b33a', 500: 'rgb(var(--accent) / <alpha-value>)', 600: '#d9881a' },
        cream: { 50: '#fefcfa', 100: '#fbf6f2', 200: '#f4ece7' },
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      maxWidth: { site: '1536px' },
      boxShadow: { card: '0 2px 10px rgba(40, 20, 60, 0.06)', lift: '0 8px 24px rgba(40, 20, 60, 0.12)' },
    },
  },
  plugins: [],
} satisfies Config;
