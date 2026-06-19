/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        canvas: '#EDE4D1',
        surface: '#F8F3E8',
        'surface-raised': '#FFFCF5',
        ink: '#252821',
        muted: '#74776E',
        border: '#D8CEBB',
        sage: '#7A9B76',
        'sage-dark': '#506D4F',
        'sage-soft': '#DDE7D8',
        water: '#7895A6',
        gold: '#B59A5B',
        clay: '#A87962',
        error: '#A45E54',
        'error-soft': '#F1DDD7',
        'dark-canvas': '#1B2028',
        'dark-surface': '#252B34',
        'dark-ink': '#F2EEE6',
        'dark-muted': '#AEB5BE',
      },
      borderRadius: {
        app: '20px',
        control: '14px',
      },
      fontFamily: {
        sans: ['System'],
        rounded: ['System'],
      },
    },
  },
  plugins: [],
};
