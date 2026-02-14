import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // New design system colors
        page: {
          bg: '#0F0F0F',
        },
        card: {
          DEFAULT: '#141414',
        },
        control: {
          bg: '#1E1E1E',
        },
        surface: '#1A1A1A',
        border: {
          subtle: '#2A2A2A',
          card: '#1E1E1E',
        },
        accent: {
          primary: '#818CF8',
          blue: '#60A5FA',
          green: '#34D399',
          amber: '#FBBF24',
          coral: '#FF6B6B',
        },
        text: {
          primary: '#F5F5F5',
          secondary: '#9CA3AF',
          tertiary: '#6B7280',
          disabled: '#4B5563',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      borderRadius: {
        '2xl': '16px',
        'xl': '12px',
      },
    },
  },
  plugins: [],
}

export default config
