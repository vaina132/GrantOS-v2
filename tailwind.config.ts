import type { Config } from 'tailwindcss'
import tailwindcssAnimate from 'tailwindcss-animate'

const config: Config = {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        // Inter Tight — tight-tracking display companion to Inter.
        // Used for all display/headline copy on the marketing site.
        display: [
          'Inter Tight Variable',
          'Inter Tight',
          'Inter Variable',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          'sans-serif',
        ],
        // Inter — body / UI default. Shared with the app (app is already on
        // the system sans stack; adding Inter here does not break it).
        sans: [
          'Inter Variable',
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        // JetBrains Mono — labels, eyebrows, metrics.
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'monospace',
        ],
      },
      colors: {
        // Existing shadcn/ui tokens — still used across the rest of the app.
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        // ── Marketing site palette ("Lindisfarne") ───────────────────────────
        // Canvas / surfaces — warm ivory, not stark white.
        canvas: {
          DEFAULT: '#F7F5EF',
          raised: '#FFFFFF',
          warm: '#F1EDE2',
        },
        // Foregrounds — navy-ink, not pure black. Reads softer at display sizes.
        foreground2: {
          DEFAULT: '#0B1B2B',
          soft: '#1A2B3C',
          muted: '#5A6B7B',
        },
        // Rules / hairlines — ivory-tinted, not neutral grey.
        rule: {
          DEFAULT: '#E4E1D8',
          soft: '#EDEAE1',
        },
        // Accent — deep teal. AAA contrast on canvas (7.5:1) and raised (8.2:1).
        // This is the ONLY accent colour on the marketing site. Never red.
        brand: {
          DEFAULT: '#0F4C5C',
          hover:   '#0B3A47',
          pressed: '#082B35',
          wash:    '#E6EEF0', // quiet tinted background for callouts
          ink:     '#F0F7F8', // accent-foreground on filled buttons
        },
        // State (non-accent) — ochre warning, forest success, burgundy error.
        // Burgundy replaces red for error semantics; still not vermillion.
        state: {
          success: '#2F7D5B',
          warning: '#B07A1F',
          error:   '#8C2F3A',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      letterSpacing: {
        tight2: '-0.02em',
        snug: '-0.01em',
        label: '0.08em',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [tailwindcssAnimate],
}

export default config
