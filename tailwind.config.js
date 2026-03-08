/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0f1117",
        energy: "#f59e0b",
        food: "#22c55e",
        finance: "#3b82f6",
        political: "#ef4444",
        military: "#6b7280",
        supply_chain: "#a855f7",
      },
    },
  },
  plugins: [],
};
