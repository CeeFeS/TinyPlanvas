import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Paper & Notebook colors (variable-driven for light/dark theming)
        paper: {
          cream: 'rgb(var(--paper-cream-rgb) / <alpha-value>)',
          warm: 'rgb(var(--paper-warm-rgb) / <alpha-value>)',
          lines: 'rgb(var(--paper-lines-rgb) / <alpha-value>)',
          margin: 'rgb(var(--paper-margin-rgb) / <alpha-value>)',
        },
        // Card / raised surfaces (replaces hard-coded white)
        surface: {
          DEFAULT: 'rgb(var(--surface-rgb) / <alpha-value>)',
          raised: 'rgb(var(--surface-raised-rgb) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--ink-default-rgb) / <alpha-value>)',
          light: 'rgb(var(--ink-light-rgb) / <alpha-value>)',
          faded: 'rgb(var(--ink-faded-rgb) / <alpha-value>)',
          blue: 'rgb(var(--ink-blue-rgb) / <alpha-value>)',
          red: 'rgb(var(--ink-red-rgb) / <alpha-value>)',
        },
        // Allocation chip colors (GitHub-style)
        chip: {
          green: {
            100: '#9BE9A8',
            200: '#40C463',
            300: '#30A14E',
            400: '#216E39',
            500: '#1B5E30',
          },
          blue: {
            100: '#9ECAE1',
            200: '#6BAED6',
            300: '#3182BD',
            400: '#08519C',
          },
          orange: {
            100: '#FDAE6B',
            200: '#FD8D3C',
            300: '#E6550D',
            400: '#A63603',
          },
          purple: {
            100: '#BCBDDC',
            200: '#9E9AC8',
            300: '#756BB1',
            400: '#54278F',
          },
        },
      },
      fontFamily: {
        // Modern serif for titles (next/font Source Serif 4; Times-like fallbacks)
        hand: ['var(--font-source-serif)', '"Times New Roman"', 'Times', 'Georgia', 'serif'],
        // Clean sans for UI / data
        sans: ['var(--font-source-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        // Monospace for numbers
        mono: ['var(--font-jetbrains)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'paper': '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        'paper-hover': '0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.05)',
        'sticker': '2px 2px 0 rgba(0,0,0,0.05)',
      },
      backgroundImage: {
        'notebook-lines': 'repeating-linear-gradient(transparent, transparent 31px, var(--paper-lines) 31px, var(--paper-lines) 32px)',
        'paper-texture': 'url("/paper-texture.png")',
      },
    },
  },
  plugins: [],
}

export default config
