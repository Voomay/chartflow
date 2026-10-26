/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tv: {
          bg: '#0b0e14',
          panel: '#131722',
          card: '#1e222d',
          border: '#2a2e39',
          hover: '#262b38',
          text: '#d1d4dc',
          muted: '#787b86',
          gold: '#f59e0b',
          up: '#089981',
          down: '#f23645',
          blue: '#2962ff'
        }
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Trebuchet MS', 'Roboto', 'Ubuntu', 'sans-serif'],
        mono: ['JetBrains Mono', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace']
      }
    },
  },
  plugins: [],
}
