/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        navy: {
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#0c1a3a'
        },
        cyan: {
          400: '#22d3ee',
          500: '#0ea5e9'
        }
      },
      fontFamily: {
        heading: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        body: ['"Source Sans 3"', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
