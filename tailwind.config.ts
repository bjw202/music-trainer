import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Dark theme colors
        background: {
          primary: '#1a1a1a',
          secondary: '#2a2a2a',
        },
        text: {
          primary: '#e0e0e0',
          secondary: '#a0a0a0',
        },
        accent: {
          blue: '#007aff',
          red: '#ff3b30',
          green: '#34c759',
        },
      },
    },
  },
  plugins: [],
}

export default config
