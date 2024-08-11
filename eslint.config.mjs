import eslintConfigPrettier from "eslint-config-prettier";
import pluginJs from "@eslint/js";

import importPlugin from "eslint-plugin-import";
import unusedImports from "eslint-plugin-unused-imports";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: [
      ".yarn/**/*",
      "**/node_modules/**/*",
      "**/cdk.out/**/*",
      "**/dist/**/*",
    ],
  },
  {
    languageOptions: {
      globals: {
        module: "readonly",
      },
    },
  },
  eslintConfigPrettier,
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: {
        module: "readonly",
      },
    },
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
