import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Paper & Notebook colors
        paper: {
          cream: '#FAF8F5',
          warm: '#F5F2ED',
          lines: '#E8E4DD',
          margin: '#FFCCCB',
        },
        ink: {
          DEFAULT: '#2D3436',
          light: '#636E72',
          faded: '#B2BEC3',
          blue: '#0984E3',
          red: '#D63031',
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
        // Handwritten feel for headers
        hand: ['var(--font-kalam)', 'cursive'],
        // Clean sans for data
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        // Monospace for numbers
        mono: ['var(--font-mono)', 'monospace'],
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
