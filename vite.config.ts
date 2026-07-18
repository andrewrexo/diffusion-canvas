import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const rdProxy = {
  '/api/rd': {
    target: 'https://api.retrodiffusion.ai',
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api\/rd/, ''),
  },
}

export default defineConfig({
  plugins: [react()],
  server: { proxy: rdProxy },
  preview: { proxy: rdProxy },
  test: {
    setupFiles: ['./vitest.setup.ts'],
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
