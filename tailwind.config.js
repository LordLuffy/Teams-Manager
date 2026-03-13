/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: {
          primary:   "#0d1117",
          secondary: "#161b22",
          card:      "#21262d",
          hover:     "#2a313c",
        },
        accent: {
          blue:    "#2563eb",
          blue2:   "#3b82f6",
          purple:  "#7c3aed",
        },
        border: {
          DEFAULT: "#30363d",
          light:   "#21262d",
        },
        text: {
          primary:   "#e6edf3",
          secondary: "#8b949e",
          muted:     "#6e7681",
        },
        status: {
          ok:   "#3fb950",
          warn: "#d29922",
          err:  "#f85149",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};