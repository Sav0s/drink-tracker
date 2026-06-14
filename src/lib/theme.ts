import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";

const config = defineConfig({
  theme: {
    tokens: {
      radii: {
        sm:   { value: "8px" },
        md:   { value: "12px" },
        lg:   { value: "16px" },
        xl:   { value: "20px" },
        "2xl": { value: "24px" },
        "3xl": { value: "28px" },
        full: { value: "9999px" },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
