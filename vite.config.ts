import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { loadEnv } from 'vite'
import { handleWenshanApi } from './server/wenshanApi'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = cleanEnv({
    ...loadEnv(mode, process.cwd(), ''),
    ...process.env,
  })
  return {
    plugins: [
      vue(),
      {
        name: 'wenshan-api',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            if (await handleWenshanApi(req, res, env)) return
            next()
          })
        },
      },
    ],
  }
})

function cleanEnv(input: Record<string, string | undefined>): Record<string, string> {
  const output: Record<string, string> = {}
  for (const [key, value] of Object.entries(input)) {
    if (typeof value === 'string') output[key] = value
  }
  return output
}
