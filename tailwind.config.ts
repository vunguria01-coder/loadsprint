import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#0F172A",
        "navy-900": "#0B1120",
        "navy-800": "#111c30",
        brand: "#2563EB",
        sky: "#38BDF8",
      },
      fontFamily: {
        display: ["Poppins", "sans-serif"],
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["Manrope", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
