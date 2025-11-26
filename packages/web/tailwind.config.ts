import type { Config } from "tailwindcss";

export default {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Weather Oracle brand colors
        primary: {
          50: "#eff6ff",
          100: "#dbeafe",
          200: "#bfdbfe",
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#1e3a8a",
        },
        confidence: {
          high: "#22c55e",
          medium: "#f59e0b",
          low: "#ef4444",
        },
      },
      animation: {
        "spin-slow": "spin 3s linear infinite",
        "pulse-soft": "pulse 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
