import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#F2F4F7',
        ink: '#20283A',
        mute: '#929BA8',
        card: '#F4F6FA',
        biz: { bg: '#FFF3F1', line: '#F6DED9', accent: '#E69A91', text: '#B56E66', pill: '#FCE8E4', deep: '#A65F56' },
        priv: { bg: '#F0F5FF', line: '#DDE8FC', accent: '#719CE9', text: '#527DBE', pill: '#E6EEFF', deep: '#4E78BE' },
        ok: { bg: '#F0FAF3', line: '#D9EFDF', accent: '#3BA46B', text: '#528B66', bar: '#8FD6A9' },
      },
      borderRadius: { card: '20px', xl2: '24px' },
      boxShadow: { app: '0 10px 40px rgba(32,40,58,0.05)', fab: '0 5px 20px rgba(32,40,58,0.33)' },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
