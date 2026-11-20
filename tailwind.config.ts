import type { Config } from "tailwindcss";

/**
 * SeoWaveTech "Highlighter editorial" system.
 * Warm newsprint paper, warm-black ink, hairline rules, one neon highlighter accent.
 * `white` is remapped to a warm card stock so every surface sits on the same paper family.
 */
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        white: "#FCFAF5",
        ink: {
          950: "#12100D",
          900: "#1B1915",
          800: "#2C2924",
          700: "#38342D",
          600: "#4A453D",
          500: "#5F594F",
          400: "#7E776B",
          300: "#B3AB9C",
          200: "#D3CBBB",
          150: "#E2DBCC",
          100: "#EBE5D8",
          50: "#F4F0E7",
        },
        paper: "#F5F2EB",
        lime: {
          DEFAULT: "#E4FF3C", // the highlighter
          soft: "#F2FBB4",
          deep: "#556300",
        },
        // Chart categorical slots (validated order — never cycle or re-order)
        series: {
          1: "#2a78d6",
          2: "#eb6834",
          3: "#1baf7a",
          4: "#eda100",
          5: "#e87ba4",
          6: "#008300",
          7: "#6250d6",
          8: "#e34948",
        },
        good: { DEFAULT: "#17784A", soft: "#E2F0E4" },
        warn: { DEFAULT: "#A35F00", soft: "#F8EBD3" },
        bad: { DEFAULT: "#B8322A", soft: "#F7E1DC" },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "ui-serif", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      boxShadow: {
        card: "0 1px 0 rgba(18,16,13,0.05)",
        lift: "3px 3px 0 0 #12100D",
        hard: "2px 2px 0 0 #12100D",
        ring: "0 0 0 1px rgba(18,16,13,0.12)",
      },
      borderRadius: { lg: "5px", xl: "6px", "2xl": "8px" },
      keyframes: {
        "fade-up": { "0%": { opacity: "0", transform: "translateY(8px)" }, "100%": { opacity: "1", transform: "none" } },
        pulseDot: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0.35" } },
        shimmer: { "0%": { backgroundPosition: "-400px 0" }, "100%": { backgroundPosition: "400px 0" } },
        swipe: { "0%": { backgroundSize: "0% 100%" }, "100%": { backgroundSize: "100% 100%" } },
      },
      animation: {
        "fade-up": "fade-up .5s cubic-bezier(.2,.7,.2,1) both",
        "pulse-dot": "pulseDot 1.4s ease-in-out infinite",
        shimmer: "shimmer 1.6s linear infinite",
        swipe: "swipe .9s cubic-bezier(.65,.05,.36,1) .35s both",
      },
    },
  },
  plugins: [],
} satisfies Config;
