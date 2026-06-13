import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const config = defineConfig({
  theme: {
    tokens: {
      colors: {
        brand: {
          DEFAULT: { value: "#0468b3" },
          600: { value: "#0576cc" },
          700: { value: "#055291" },
          tint: { value: "rgba(4,104,179,0.16)" },
        },
        steel: {
          DEFAULT: { value: "#6478a0" },
          600: { value: "#7589b0" },
          tint: { value: "rgba(100,120,160,0.16)" },
        },
        bg: { DEFAULT: { value: "#0d1014" } },
        surface: {
          DEFAULT: { value: "#151a21" },
          2: { value: "#1b212b" },
          3: { value: "#222934" },
        },
        panel: { DEFAULT: { value: "#161c25" } },
        line: {
          DEFAULT: { value: "rgba(255,255,255,0.07)" },
          2: { value: "rgba(255,255,255,0.12)" },
        },
        hair: { DEFAULT: { value: "rgba(255,255,255,0.05)" } },
        text: { DEFAULT: { value: "#eaedf2" } },
        muted: { DEFAULT: { value: "#939dab" } },
        faint: { DEFAULT: { value: "#5c6675" } },
        success: {
          DEFAULT: { value: "#2fa968" },
          tint: { value: "rgba(47,169,104,0.15)" },
        },
        amber: {
          DEFAULT: { value: "#d6a23a" },
          tint: { value: "rgba(214,162,58,0.15)" },
        },
        danger: {
          DEFAULT: { value: "#e0535f" },
          tint: { value: "rgba(224,83,95,0.14)" },
        },
      },
      radii: {
        sm: { value: "8px" },
        md: { value: "12px" },
        lg: { value: "16px" },
        xl: { value: "20px" },
        pill: { value: "999px" },
      },
      shadows: {
        "sh-1": { value: "0 1px 2px rgba(0,0,0,0.3)" },
        "sh-2": { value: "0 8px 24px -12px rgba(0,0,0,0.55)" },
        "sh-3": { value: "0 22px 50px -22px rgba(0,0,0,0.75)" },
        "brand-glow": {
          value: "0 8px 20px -8px rgba(4,104,179,0.7)",
        },
        "steel-glow": {
          value: "0 8px 20px -8px rgba(100,120,160,0.6)",
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
