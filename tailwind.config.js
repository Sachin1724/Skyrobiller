/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      // Semantic tokens; values (light + dark) live in src/index.css
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        sidebar: token('sidebar'),
        line: token('line'),
        ink: token('ink'),
        'ink-2': token('ink-2'),
        'ink-3': token('ink-3'),
        accent: token('accent'),
        danger: token('danger'),
        success: token('success'),
        warn: token('warn'),
      },
      // Rounded rectangles, not pills: one tight radius scale for the whole app
      borderRadius: {
        DEFAULT: '3px',
        md: '3px',
        lg: '4px',
        xl: '6px',
        '2xl': '8px',
      },
      fontFamily: {
        sans: ['-apple-system', '"SF Pro Text"', '"Segoe UI Variable Text"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
