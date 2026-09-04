/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'autopsy-bg': '#0B0B0B',
        'autopsy-surface': '#111111',
        'autopsy-border': '#1E1E1E',
        'autopsy-text': '#F5F5F0',
        'autopsy-text-muted': '#8A8A8A',
        'autopsy-accent': '#D6A62A',
        'autopsy-accent-hover': '#E8B842',
        'autopsy-accent-light': '#F5E6A8',
        'autopsy-success': '#2E7D32',
        'autopsy-warning': '#D6A62A',
        'autopsy-error': '#C62828',
        'autopsy-info': '#1565C0'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace']
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' }
        }
      }
    },
  },
  plugins: [],
}