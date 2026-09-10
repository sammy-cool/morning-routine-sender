import js from "@eslint/js";
import globals from "globals";
import eslintConfigPrettier from "eslint-config-prettier";

/**
 * ESLint 9 Flat Configuration
 * Tailored for Node.js 20 (CommonJS backend), Jest testing suite,
 * and browser client scripts (Vanilla JS + Service Worker).
 */
export default [
  // 1. Global Ignores: third-party vendor assets, build artifacts, coverage, logs, env
  {
    ignores: [
      "**/node_modules/**",
      "**/coverage/**",
      "**/logs/**",
      "**/dist/**",
      "**/build/**",
      "public/vendor/**",
      "public/js/npm-mod/**",
      "admin-renderer/js/npm-mod/**",
      "public/assets/**",
      "**/*.min.js",
      "**/*.min.css",
      ".env",
      ".env.*",
      "package-lock.json",
    ],
  },

  // 2. Base recommended JavaScript rules
  js.configs.recommended,

  // 3. Node.js 20 & Express Backend (Server, Controllers, Middleware, Routes, DB, Helpers, Scripts)
  {
    files: [
      "*.js",
      "config/**/*.js",
      "controllers/**/*.js",
      "db/**/*.js",
      "email-core/**/*.js",
      "push-core/**/*.js",
      "helper/**/*.js",
      "middleware/**/*.js",
      "routes/**/*.js",
      "scripts/**/*.js",
    ],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.nodeBuiltin,
        ...globals.es2024,
      },
    },
    rules: {
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_|^(next|req|res)$",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "no-console": "off",
      "no-undef": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-var": "error",
      "prefer-const": ["warn", { destructuring: "all" }],
      "no-useless-escape": "warn",
    },
  },

  // 4. Browser Client Scripts (public/js/**/*.js & admin-renderer/js/**/*.js)
  {
    files: ["public/js/**/*.js", "admin-renderer/js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "script",
      globals: {
        ...globals.browser,
        ...globals.es2024,
        customizableToast: "readonly",
        Chart: "readonly",
      },
    },
    rules: {
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  // 5. Service Worker (public/sw.js)
  {
    files: ["public/sw.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "script",
      globals: {
        ...globals.serviceworker,
        ...globals.browser,
        ...globals.es2024,
      },
    },
    rules: {
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  // 6. Test Files (Jest Suite: __tests__/**/*.js)
  {
    files: ["__tests__/**/*.js"],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: "commonjs",
      globals: {
        ...globals.node,
        ...globals.jest,
        ...globals.es2024,
      },
    },
    rules: {
      "no-unused-vars": "off",
    },
  },

  // 7. ESLint Prettier Integration (Must be last to turn off conflicting styling rules)
  eslintConfigPrettier,
];
