import { defineConfig, globalIgnores } from "eslint/config";
import next_vitals from "eslint-config-next/core-web-vitals";
import next_typescript from "eslint-config-next/typescript";

export default defineConfig([
  ...next_vitals,
  ...next_typescript,
  globalIgnores([".next/**", "out/**", "next-env.d.ts"]),
]);
