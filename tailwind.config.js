/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    // One type scale for the whole app: 12 (hints, labels, badges), 13 (body, tables, buttons), 14 (section headings), 18 (titles, key figures)
    fontSize: {
      xs: ['12px', '16px'],
      sm: ['13px', '18px'],
      base: ['14px', '20px'],
      lg: ['18px', '24px'],
    },
    // Radius: 4px for controls, 6px (md) for cards, sheets and menus
    borderRadius: {
      none: '0',
      sm: '2px',
      DEFAULT: '4px',
      md: '6px',
      full: '9999px',
    },
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
        'on-accent': token('on-accent'),
        danger: token('danger'),
        success: token('success'),
        warn: token('warn'),
      },
      fontFamily: {
        sans: ['"Segoe UI Variable Text"', '"Segoe UI Variable"', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
