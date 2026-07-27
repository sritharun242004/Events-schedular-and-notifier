import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "var(--font-sans)", "sans-serif"],
      },
      colors: {
        ink: {
          DEFAULT: "#17161C",
          soft: "#211F28",
          line: "#312E3A",
        },
        paper: "#F3F2EF",
        card: "#FFFFFF",
        line: "#E7E6E1",
        muted: "#7C7A85",
        amber: {
          DEFAULT: "#E8A317",
          dark: "#C4870A",
          soft: "#FBF0D6",
        },
        ok: "#1C9E6E",
      },
      boxShadow: {
        card: "0 1px 2px rgba(23,22,28,0.04), 0 8px 24px rgba(23,22,28,0.05)",
        pop: "0 12px 40px rgba(23,22,28,0.18)",
      },
      borderRadius: {
        xl: "14px",
      },
    },
  },
  plugins: [],
} satisfies Config;
