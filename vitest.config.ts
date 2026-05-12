import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['server/**/*.test.ts', 'src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      all: true,
      include: [
        'server/xiguoTaskAccess.ts',
        'server/lib/safeUpstream.ts',
        'server/kotovelaAccess.ts',
      ],
      thresholds: {
        lines: 80,
      },
    },
  },
})
