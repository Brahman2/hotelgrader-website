/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}'],
  theme: {
    extend: {
      colors: {
        bone: '#F7F4F0',
        paper: '#FBF9F6',
        ink: '#0B1220',
        'ink-60': 'rgba(11, 18, 32, 0.6)',
        'ink-40': 'rgba(11, 18, 32, 0.4)',
        indigo: '#5B5BD6',
        cta: '#D9531C',
        'cta-hover': '#C24716',
        'cta-press': '#A93D12',
        edge: '#E6E6E1',
        'edge-strong': '#D5D4CE',
        good: '#1E7F4B',
        warn: '#D98A1C',
        attention: '#C6453D',
        slate: '#69707A',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        serif: ['"Source Serif 4"', 'Georgia', '"Times New Roman"', 'serif'],
        display: ['"Inter Display"', 'Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', '"SF Mono"', 'Menlo', 'Consolas', 'monospace'],
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
