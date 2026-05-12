import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import { handleWenshanApi } from './wenshanApi.js'

// ─── Environment ───────────────────────────────────────────────
function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  const envPath = resolve(process.cwd(), '.env')
  if (existsSync(envPath)) {
    const text = readFileSync(envPath, 'utf-8')
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const idx = trimmed.indexOf('=')
      if (idx <= 0) continue
      const key = trimmed.slice(0, idx).trim()
      const value = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
      env[key] = value
    }
  }
  // Override with process.env (e.g., set by systemd/PM2/docker)
  for (const [key, value] of Object.entries(process.env)) {
    if (value) env[key] = value
  }
  return env
}

// ─── Static file serving (fallback for dev / direct access) ──
const DIST_DIR = resolve(process.cwd(), 'dist')
const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
}

async function serveStatic(url: URL, res: ServerResponse): Promise<boolean> {
  const pathname = url.pathname === '/' ? '/index.html' : url.pathname
  let filePath = join(DIST_DIR, pathname)

  if (!existsSync(filePath)) {
    // SPA fallback: serve index.html for all non-file routes
    filePath = join(DIST_DIR, 'index.html')
  }
  if (!existsSync(filePath)) return false

  try {
    const data = readFileSync(filePath)
    const ext = extname(filePath)
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control':
        ext === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    })
    res.end(data)
    return true
  } catch {
    return false
  }
}

// ─── Server ────────────────────────────────────────────────────
const env = loadEnv()
const PORT = parseInt(env.PORT || '3001', 10)

const server = createServer(async (req, res) => {
  try {
    // 1) API routes
    if (await handleWenshanApi(req, res, env)) return

    // 2) Static files — handy when running behind Nginx isn't needed
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (await serveStatic(url, res)) return

    res.writeHead(404)
    res.end('Not Found')
  } catch (error) {
    console.error('[wenshan] server error:', error)
    res.writeHead(500)
    res.end('Internal Server Error')
  }
})

server.listen(PORT, () => {
  console.log(`[wenshan] API server running at http://localhost:${PORT}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[wenshan] SIGTERM received, shutting down…')
  server.close(() => process.exit(0))
})
process.on('SIGINT', () => {
  console.log('[wenshan] SIGINT received, shutting down…')
  server.close(() => process.exit(0))
})
