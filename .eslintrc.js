module.exports = {
  extends: ['next/core-web-vitals'],
  rules: {
    // Disable rules that cause issues during build
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': 'warn',
    'import/no-anonymous-default-export': 'warn',
  },
  overrides: [
    {
      // Apply specific rules to API routes
      files: ['**/app/api/**/*.ts'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
      },
    },
  ],
};
