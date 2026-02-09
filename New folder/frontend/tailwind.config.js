/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        night: "#0b1220",
        panel: "#0f172a",
        accent: "#34d399",
      },
      boxShadow: {
        glow: "0 20px 80px rgba(52, 211, 153, 0.15)",
      },
    },
  },
  plugins: [],
};
