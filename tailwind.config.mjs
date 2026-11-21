/** @type {import('tailwindcss').Config} */
// Two themes, one set of names. Every colour, the font and the corner radius
// are CSS variables defined in src/styles/global.css: light is
// clean and sans-serif, dark (the default) is the terminal look in IBM Plex Mono.
const mono = ['"IBM Plex Mono"', 'ui-monospace', 'Menlo', 'monospace'];

export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        paper: 'var(--paper)',            // page background
        'paper-deep': 'var(--paper-deep)', // raised surfaces
        ink: 'var(--ink)',                // text
        'ink-60': 'var(--ink-60)',
        'ink-40': 'var(--ink-40)',
        accent: 'var(--accent)',
        edge: 'var(--edge)',
        'edge-strong': 'var(--edge-strong)',
        good: 'var(--grade-a)',
        warn: 'var(--grade-c)',
        attention: 'var(--grade-f)',
      },
      fontFamily: { sans: ['var(--font)'], serif: ['var(--font)'], mono },
      borderRadius: { DEFAULT: 'var(--radius)', sm: '2px' },
      maxWidth: { content: '880px' },
    },
  },
  plugins: [],
};
