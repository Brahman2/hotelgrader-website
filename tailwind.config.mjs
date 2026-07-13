/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        // Warm paper foundation (see BRAND.md)
        paper: '#FBF7EE',         // page background, warm near-white
        'paper-deep': '#F3EBDA',  // cards, section alternation
        bone: '#F3EBDA',          // legacy alias -> paper-deep (card/surface fills)
        ink: '#26221B',           // warm near-black text (never pure #000)
        'ink-60': 'rgba(38, 34, 27, 0.62)',
        'ink-40': 'rgba(38, 34, 27, 0.42)',
        'ink-soft': '#6B6355',    // secondary text, captions
        // iris: interactive color ONLY (links, focus, selected states, "you" data)
        indigo: '#5B5BD6',
        'indigo-strong': '#4646B0',
        // sun: brand accent / CTAs / grade emphasis
        sun: '#D98A1C',
        cta: '#D98A1C',
        'cta-hover': '#C67C12',
        'cta-press': '#B06E10',
        edge: '#E6E6E1',
        'edge-strong': '#D5D4CE',
        good: '#1E7F4B',
        warn: '#D98A1C',
        attention: '#C6453D',
        slate: '#6B6355',
      },
      fontFamily: {
        sans: ['"Source Sans 3"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', '"Times New Roman"', 'serif'],
        display: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      fontSize: {
        label: ['11px', { lineHeight: '1.2', letterSpacing: '0.08em' }],
        'body-sm': ['13px', { lineHeight: '1.5' }],
        body: ['15px', { lineHeight: '1.5' }],
      },
      letterSpacing: {
        label: '0.08em',
        tight: '-0.01em',
        tighter: '-0.02em',
        tightest: '-0.025em',
      },
      borderRadius: {
        DEFAULT: '6px',
        sm: '4px',
        favicon: '8px',
      },
      borderWidth: {
        hair: '1px',
      },
      maxWidth: {
        content: '1040px',
      },
      transitionTimingFunction: {
        ease: 'cubic-bezier(0.2, 0, 0, 1)',
      },
      transitionDuration: {
        fast: '120ms',
        DEFAULT: '180ms',
      },
    },
  },
  plugins: [],
};
