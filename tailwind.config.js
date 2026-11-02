/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef6ff',
          100: '#d9ebff',
          200: '#bcddff',
          300: '#8ec8ff',
          400: '#59a7ff',
          500: '#2f81f7',
          600: '#1f64e5',
          700: '#194fc8',
          800: '#1940a0',
          900: '#1a377e',
          950: '#11224d',
        },
        cyber: {
          cyan: '#00f2fe',
          neon: '#4facfe',
          dark: '#070d19',
          card: '#0f172a',
          border: '#1e293b'
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'scan': 'scan 2.5s ease-in-out infinite alternate',
        'pulse-glow': 'pulseGlow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        scan: {
          '0%': { transform: 'translateY(0%)' },
          '100%': { transform: 'translateY(100%)' },
        },
        pulseGlow: {
          '0%, 100%': { opacity: '0.6', boxShadow: '0 0 15px rgba(0, 242, 254, 0.4)' },
          '50%': { opacity: '1', boxShadow: '0 0 30px rgba(0, 242, 254, 0.8)' },
        }
      }
    },
  },
  plugins: [],
}
