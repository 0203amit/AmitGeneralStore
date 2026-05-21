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
          accent: '#BA7517',
          green: '#085041',
        },
      },
    },
  },
  plugins: [],
};
