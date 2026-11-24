/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#eef1f8', 100: '#d9e0f0', 200: '#b3c0e0', 500: '#2b4384', 600: '#1f3470', 700: '#182a5d', 800: '#14254f', 900: '#0e1a3a' },
        gold: { 100: '#f6edd8', 400: '#d6b366', 500: '#c9a14a', 600: '#ad8634' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        serif: ['"Libre Baskerville"', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
};
