/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#3C3489',
          primaryLight: '#E8E6F0',
          accent: '#BA7517',
          accentLight: '#FDF3E3',
          green: '#085041',
          greenLight: '#E6F2EF',
        },
      },
      fontFamily: {
        heading: ['Rubik', 'sans-serif'],
        body: ['Nunito Sans', 'sans-serif'],
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeOut: {
          '0%': { opacity: '1' },
          '100%': { opacity: '0' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideDown: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideUp: {
          '0%': { opacity: '1', transform: 'translateY(0)' },
          '100%': { opacity: '0', transform: 'translateY(-8px)' },
        },
        toastIn: {
          '0%': { opacity: '0', transform: 'translateX(100%)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        toastOut: {
          '0%': { opacity: '1', transform: 'translateX(0)' },
          '100%': { opacity: '0', transform: 'translateX(100%)' },
        },
      },
      animation: {
        fadeIn: 'fadeIn 200ms ease-out',
        fadeOut: 'fadeOut 200ms ease-in',
        scaleIn: 'scaleIn 200ms ease-out',
        slideDown: 'slideDown 200ms ease-out',
        slideUp: 'slideUp 200ms ease-in',
        toastIn: 'toastIn 300ms ease-out',
        toastOut: 'toastOut 200ms ease-in forwards',
      },
    },
  },
  plugins: [],
};
