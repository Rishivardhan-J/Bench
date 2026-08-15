import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    spacing: {
      0: '0px',
      4: '4px',
      8: '8px',
      12: '12px',
      16: '16px',
      20: '20px',
      24: '24px',
      28: '28px',
      32: '32px',
      40: '40px',
      48: '48px',
      56: '56px',
      64: '64px',
      80: '80px',
      96: '96px',
      128: '128px',
      256: '256px',
    },
    extend: {
      colors: {
        bg:            '#000000',
        surface:       '#0A0A0A',
        'surface-2':   '#111111',
        'surface-3':   '#171717',
        border:        '#1F1F1F',
        'border-strong': '#2E2E2E',
        text:          '#FFFFFF',
        'text-dim':    '#A1A1A1',
        'text-mute':   '#666666',
        accent:        '#3291FF',
        'accent-dim':  '#0C1B2E',
        'accent-text': '#52A9FF',
      },
      fontFamily: {
        sans: ['Inter Variable', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        '10': ['10px', { lineHeight: '1' }],
        '11': ['11px', { lineHeight: '1' }],
        'micro-label': ['11px', { lineHeight: '1', letterSpacing: '0.05em', fontWeight: '600' }],
        'meta': ['13px', { lineHeight: '1.5', fontWeight: '400' }],
        'body': ['14px', { lineHeight: '1.5', fontWeight: '400' }],
        'section-heading': ['20px', { lineHeight: '1.2', fontWeight: '600' }],
        'hero': ['36px', { lineHeight: '1.1', letterSpacing: '-1px', fontWeight: '700' }],
      },
      borderRadius: {
        badge: '5px',
        sm: '6px',
        md: '8px',
        lg: '10px',
        xl: '12px',
      }
    },
  },
  plugins: [],
} satisfies Config
