/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    // Sidebar responsive classes used dynamically
    'md:flex',
    'md:hidden',
    'hidden',
    'flex',
    // Drawer translation states
    'translate-x-0',
    '-translate-x-full',
    // Width transitions
    'w-16',
    'w-64',
    'w-72',
    // Opacity/pointer-events for backdrop
    'opacity-0',
    'opacity-100',
    'pointer-events-none',
    'pointer-events-auto',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
