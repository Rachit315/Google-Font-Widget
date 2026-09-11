/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./public/**/*.{html,js}'],
  theme: {
    extend: {
      colors: {
        ink: '#161616',
        paper: '#f1f0ee',
        panel: '#0a0a0a',
        brand: '#ff6b00',
        muted: '#a3a3a3',
      },
      transitionTimingFunction: {
        // Strong custom curves — the built-in CSS easings are too weak (animations.dev)
        'out-strong': 'cubic-bezier(0.23, 1, 0.32, 1)',
        'in-out-strong': 'cubic-bezier(0.77, 0, 0.175, 1)',
      },
    },
  },
  plugins: [],
};
