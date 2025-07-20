import eslint from "@eslint/js"
import tseslint from "typescript-eslint"
import prettier from "eslint-plugin-prettier"
import prettierConfig from "eslint-config-prettier"

// Create a Prettier configuration object
const prettierRules = {
  semi: false,
  singleQuote: false,
  trailingComma: "all",
  printWidth: 100,
  tabWidth: 2,
}

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  prettierConfig,
  {
    ignores: ["eslint.config.js", "build.js", "dist/**", "coverage/**"], // Exclude this config file and build outputs from linting
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      prettier: prettier,
    },
    rules: {
      // TypeScript rules
      "@typescript-eslint/explicit-function-return-type": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": "error",

      // Formatting rules
      "prefer-arrow-callback": "error",

      // Prettier rules
      "prettier/prettier": ["error", prettierRules],
    },
  },
  {
    // Test files config
    files: ["test/**/*.ts"],
    rules: {
      // Allow 'any' types in test files
      "@typescript-eslint/no-explicit-any": "off",
      // Allow non-null assertions in test files
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
)
