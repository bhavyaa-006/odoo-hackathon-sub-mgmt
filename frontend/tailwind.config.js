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
          DEFAULT: '#1F4E79',
          dark: '#163A5C',
          light: '#29659C',
        },
        mint: {
          DEFAULT: '#A8D5BA',
          light: '#E8F5EE',
          dark: '#82BCA7',
        },
        amber: {
          DEFAULT: '#FFC107',
          light: '#FFF9E6',
          dark: '#D39E00',
        },
        lightblue: {
          DEFAULT: '#E3F2FD',
          hover: '#BBDEFB',
          border: '#B3D7F5',
        },
        slateblue: {
          DEFAULT: '#4B6584',
          light: '#718AA8',
          dark: '#34495E',
        },
        offwhite: '#F5F5F5',
        charcoal: {
          DEFAULT: '#333333',
          muted: '#555555',
          light: '#777777',
        },
        teal: {
          DEFAULT: '#00796B',
          dark: '#005B51',
          light: '#E0F2F1',
        },
        coral: {
          DEFAULT: '#FF6F61',
          light: '#FFEBEE',
          dark: '#E05345',
        },
        brightblue: {
          DEFAULT: '#1E88E5',
          dark: '#1565C0',
          light: '#E3F2FD',
        },
      },
      fontFamily: {
        heading: ['Manrope', 'sans-serif'],
        sans: ['Inter', 'sans-serif'],
      },
      boxShadow: {
        'subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        'card': '0 4px 6px -1px rgba(31, 78, 121, 0.07), 0 2px 4px -1px rgba(31, 78, 121, 0.04)',
        'elevated': '0 10px 25px -5px rgba(31, 78, 121, 0.1), 0 8px 10px -6px rgba(31, 78, 121, 0.06)',
      },
      borderRadius: {
        'brand': '0.5rem',
      }
    },
  },
  plugins: [],
}
