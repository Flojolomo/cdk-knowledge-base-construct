import pluginJs from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";

import importPlugin from "eslint-plugin-import";
import unusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";

export default [
  eslintConfigPrettier,
  { files: ["**/*.{js,mjs,cjs,ts}"] },
  {
    languageOptions: {
      globals: {
        module: "readonly",
      },
    },
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "unused-imports": unusedImports,
      import: importPlugin,
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "error",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "no-param-reassign": [
        "error",
        {
          props: true,
        },
      ],
      "no-console": "error",
      "import/order": [
        "error",
        {
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
    },
  },
];
