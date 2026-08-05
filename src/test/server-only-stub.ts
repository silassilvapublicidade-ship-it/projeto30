// Stub for the "server-only" package inside Vitest (Parte K).
//
// The real package throws unconditionally unless the bundler sets Next.js's
// "react-server" import condition, which Vitest's plain Node resolver never
// does - so any file with `import "server-only"` at the top was previously
// impossible to import directly from a test, forcing every service-layer
// test in this repo into readFileSync+toContain source regression instead
// of real behavioral coverage. Aliased in vitest.config.ts only for the
// test run - production bundling (Next.js build) is untouched and still
// enforces the real server/client boundary.
export {};
