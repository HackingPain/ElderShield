/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      // Senior-friendly color palette
      colors: {
        // Primary brand colors
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        // Secondary colors
        secondary: {
          50: '#fefce8',
          100: '#fef9c3',
          200: '#fef08a',
          300: '#fde047',
          400: '#facc15',
          500: '#eab308',
          600: '#ca8a04',
          700: '#a16207',
          800: '#854d0e',
          900: '#713f12',
        },
        // Health status colors
        health: {
          excellent: '#22c55e',
          good: '#84cc16',
          fair: '#eab308',
          poor: '#f97316',
          critical: '#ef4444',
        },
        // Accessibility-focused grays
        gray: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
        },
        // Emergency/alert colors
        emergency: {
          bg: '#fef2f2',
          text: '#dc2626',
          border: '#f87171',
        },
        success: {
          bg: '#f0fdf4',
          text: '#16a34a',
          border: '#4ade80',
        },
        warning: {
          bg: '#fffbeb',
          text: '#d97706',
          border: '#fbbf24',
        },
        info: {
          bg: '#eff6ff',
          text: '#2563eb',
          border: '#60a5fa',
        }
      },
      // Senior-friendly typography
      fontSize: {
        'xs': ['0.875rem', { lineHeight: '1.25rem' }],
        'sm': ['1rem', { lineHeight: '1.5rem' }],
        'base': ['1.125rem', { lineHeight: '1.75rem' }],
        'lg': ['1.25rem', { lineHeight: '1.75rem' }],
        'xl': ['1.5rem', { lineHeight: '2rem' }],
        '2xl': ['1.875rem', { lineHeight: '2.25rem' }],
        '3xl': ['2.25rem', { lineHeight: '2.5rem' }],
        '4xl': ['3rem', { lineHeight: '3rem' }],
        '5xl': ['3.75rem', { lineHeight: '3.75rem' }],
        '6xl': ['4.5rem', { lineHeight: '4.5rem' }],
        // Extra large sizes for senior-friendly UI
        '7xl': ['6rem', { lineHeight: '6rem' }],
        '8xl': ['8rem', { lineHeight: '8rem' }],
        '9xl': ['10rem', { lineHeight: '10rem' }],
      },
      // Increased spacing for better touch targets
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
        '144': '36rem',
      },
      // Senior-friendly border radius
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
      // Enhanced shadows for better depth perception
      boxShadow: {
        'gentle': '0 2px 8px 0 rgba(0, 0, 0, 0.1)',
        'medium': '0 4px 12px 0 rgba(0, 0, 0, 0.15)',
        'strong': '0 8px 24px 0 rgba(0, 0, 0, 0.2)',
        'emergency': '0 0 20px rgba(239, 68, 68, 0.5)',
      },
      // Animation timings - slower for seniors
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'slide-down': 'slideDown 0.4s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-gentle': 'bounceGentle 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
      },
      // Screen reader and accessibility
      screens: {
        'xs': '475px',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
    // Custom plugin for senior-friendly utilities
    function({ addUtilities }) {
      const seniorUtilities = {
        '.text-high-contrast': {
          color: '#000000',
          'font-weight': '600',
        },
        '.bg-high-contrast': {
          'background-color': '#ffffff',
          color: '#000000',
        },
        '.btn-large': {
          'min-height': '3.5rem',
          'min-width': '8rem',
          'font-size': '1.25rem',
          'font-weight': '600',
          padding: '1rem 2rem',
        },
        '.btn-emergency': {
          'background-color': '#dc2626',
          color: '#ffffff',
          'font-size': '1.5rem',
          'font-weight': '700',
          'min-height': '4rem',
          'min-width': '10rem',
          'border-radius': '1rem',
          'box-shadow': '0 0 20px rgba(239, 68, 68, 0.5)',
        },
        '.card-elevated': {
          'box-shadow': '0 4px 12px 0 rgba(0, 0, 0, 0.15)',
          'border-radius': '1rem',
          'background-color': '#ffffff',
        },
        '.touch-target': {
          'min-height': '44px',
          'min-width': '44px',
        },
        '.senior-focus': {
          'outline': '3px solid #0ea5e9',
          'outline-offset': '2px',
        },
        '.text-readable': {
          'font-size': '1.125rem',
          'line-height': '1.75rem',
          'font-weight': '500',
        },
        '.gradient-health': {
          'background': 'linear-gradient(135deg, #22c55e 0%, #84cc16 100%)',
        },
        '.gradient-warning': {
          'background': 'linear-gradient(135deg, #f97316 0%, #eab308 100%)',
        },
        '.gradient-emergency': {
          'background': 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
        },
      };
      
      addUtilities(seniorUtilities);
    },
  ],
};