/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50:  '#f0f3f6',
          100: '#d6dfe8',
          200: '#b0bfcf',
          400: '#6d8699',
          600: '#3f566a',
          700: '#2C3B4B',
          800: '#1e2a36',
          900: '#111820',
        },
        lima: {
          100: '#f4fad5',
          200: '#e8f5aa',
          400: '#D2EA8E',
          500: '#b8d96a',
          600: '#8fae43',
          800: '#4a6318',
        }
      },
      fontFamily: {
        display: ['"Bebas Neue"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
