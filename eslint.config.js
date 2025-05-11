import tsParser from "@typescript-eslint/parser";
import tsPlugin from "@typescript-eslint/eslint-plugin";
import importPlugin from "eslint-plugin-import";
import prettierConfig from "eslint-config-prettier";

export default [
    {
        ignores: ["dist/**", "node_modules/**"],
    },
    {
        files: [
            // formatting
            "src/**/*.ts",
            "src/**/*.tsx",
            "test/**/*.ts",
            "test/**/*.tsx",
        ],
        languageOptions: {
            parser: tsParser,
            parserOptions: {
                ecmaVersion: 2023,
                sourceType: "module",
                project: "./tsconfig.json",
            },
        },
        plugins: {
            "@typescript-eslint": tsPlugin,
            import: importPlugin,
        },
        rules: {
            // TypeScript specific rules
            "@typescript-eslint/explicit-function-return-type": "off",
            "@typescript-eslint/no-explicit-any": "warn",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    args: "after-used",
                    argsIgnorePattern: "^_",
                    caughtErrors: "all",
                    caughtErrorsIgnorePattern: "^_",
                    destructuredArrayIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                    ignoreRestSiblings: true,
                },
            ],
            "@typescript-eslint/no-non-null-assertion": "warn",

            // Import rules
            "import/order": [
                "error",
                {
                    groups: ["builtin", "external", "internal", ["parent", "sibling"], "index", "object", "type"],
                    "newlines-between": "never",
                    alphabetize: { order: "asc", caseInsensitive: true },
                },
            ],
            "import/no-unresolved": "off", // TypeScript handles this

            // Add these rules to disallow relative imports
            "import/no-relative-parent-imports": "error", // Disallow imports like '../foo'
            "import/no-relative-packages": "error", // Disallow relative imports from packages
        },
        settings: {
            "import/resolver": {
                node: {
                    extensions: [".js", ".jsx", ".ts", ".tsx"],
                },
            },
        },
    },
    prettierConfig,
];
