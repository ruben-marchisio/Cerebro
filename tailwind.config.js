/** @type {import('tailwindcss').Config} */
const config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "#0f1115",
        surface: "#161b22",
        primary: "#3b82f6",
        accent: "#8b5cf6",
      },
      boxShadow: {
        soft: "0 10px 40px rgba(0, 0, 0, 0.35)",
      },
    },
  },
  plugins: [],
};

export default config;
