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
        // Editorial display: Fraunces (variable, with opsz axis).
        display: ['Fraunces', 'ui-serif', 'Georgia', 'serif'],
        // Body sans: Inter.
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        // Mono for metrics, callouts, mastheads.
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      colors: {
        // Existing shadcn/ui tokens (still used across the rest of the app).
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
        // Editorial palette — used by the marketing site (landing, legal pages).
        // Paper = near-white warm off-white; Ink = near-black.
        // Stone = body grey (AA-safe at 16px). Stone-soft = hairlines / borders.
        // Vermillion = single editorial accent (AAA against #FAF8F4).
        paper: {
          DEFAULT: '#FAF8F4',
          warm: '#F5F0E6',
          cool: '#F7F5F1',
        },
        ink: {
          DEFAULT: '#1A1A1A',
          soft: '#2B2B2B',
        },
        stone: {
          DEFAULT: '#9B9891', // body text / secondary copy (AA on paper)
          soft: '#8A867E',    // borders, hairlines, tertiary copy
          line: '#E6E2D9',    // rule lines
        },
        vermillion: {
          DEFAULT: '#C43A1A', // single accent — AAA on paper with white overlay
          ink:     '#A82D10',
          wash:    '#F4E3DC', // quiet tinted background for callouts
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      letterSpacing: {
        editorial: '-0.02em',
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
