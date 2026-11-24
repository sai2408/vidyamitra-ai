/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: { sans: ["Inter", "system-ui", "Segoe UI", "Roboto", "sans-serif"] },
      colors: {
        brand: {
          50: "#EEF4FF", 100: "#DCE7FE", 200: "#BACFFD", 500: "#3B6FF5", 600: "#2554E6", 700: "#1C42C4", 900: "#13245E",
        },
      },
    },
  },
  plugins: [],
};
