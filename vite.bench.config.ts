import baseConfig from './vite.config'

export default {
  ...baseConfig,
  test: {
    ...(baseConfig.test ?? {}),
    include: ['src/**/*.bench.ts'],
    exclude: [],
  },
}
