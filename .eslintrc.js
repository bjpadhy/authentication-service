module.exports = {
    env: {
        node: true,
        es2021: true,
    },
    extends: "eslint:recommended",
    parserOptions: {
        ecmaVersion: 12,
        sourceType: "module",
    },
    globals: {
        router: "readonly",
        app: "readonly",
        redis: "readonly",
        twilio: "readonly",
    },
    rules: {
        "no-unused-vars": "warn",
        "no-useless-catch": "warn",
        "no-empty": "warn",
        "no-global-assign": "ignore",
    },
};