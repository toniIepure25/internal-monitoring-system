import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],   /* 11px */
      },
      colors: {
        canvas:       "hsl(var(--canvas) / <alpha-value>)",
        canvasMuted:  "hsl(var(--canvasMuted) / <alpha-value>)",
        surface:      "hsl(var(--surface) / <alpha-value>)",
        surfaceRaised:"hsl(var(--surfaceRaised) / <alpha-value>)",
        border:       "hsl(var(--border) / <alpha-value>)",
        borderStrong: "hsl(var(--borderStrong) / <alpha-value>)",
        fg:           "hsl(var(--fg) / <alpha-value>)",
        fgMuted:      "hsl(var(--fgMuted) / <alpha-value>)",
        fgSubtle:     "hsl(var(--fgSubtle) / <alpha-value>)",
        accent:       "hsl(var(--accent) / <alpha-value>)",
        accentFg:     "hsl(var(--accent-fg) / <alpha-value>)",
        accentMuted:  "hsl(var(--accentMuted) / <alpha-value>)",
        ring:         "hsl(var(--ring) / <alpha-value>)",
        success:      "hsl(var(--success) / <alpha-value>)",
        successFg:    "hsl(var(--success-fg) / <alpha-value>)",
        successMuted: "hsl(var(--successMuted) / <alpha-value>)",
        danger:       "hsl(var(--danger) / <alpha-value>)",
        dangerFg:     "hsl(var(--danger-fg) / <alpha-value>)",
        dangerMuted:  "hsl(var(--dangerMuted) / <alpha-value>)",
        warning:      "hsl(var(--warning) / <alpha-value>)",
        warningFg:    "hsl(var(--warning-fg) / <alpha-value>)",
        warningMuted: "hsl(var(--warningMuted) / <alpha-value>)",
        info:         "hsl(var(--info) / <alpha-value>)",
        infoFg:       "hsl(var(--info-fg) / <alpha-value>)",
        infoMuted:    "hsl(var(--infoMuted) / <alpha-value>)",
      },
      boxShadow: {
        sm:      "0 1px 2px 0 rgb(0 0 0 / 0.3)",
        DEFAULT: "0 1px 3px 0 rgb(0 0 0 / 0.4), 0 1px 2px -1px rgb(0 0 0 / 0.4)",
        md:      "0 4px 6px -1px rgb(0 0 0 / 0.4), 0 2px 4px -2px rgb(0 0 0 / 0.4)",
        lg:      "0 10px 15px -3px rgb(0 0 0 / 0.4), 0 4px 6px -4px rgb(0 0 0 / 0.4)",
        ring:    "0 0 0 1px hsl(var(--border))",
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};

export default config;
