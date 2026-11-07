#!/usr/bin/env node
import http from 'node:http'
import https from 'node:https'
import net from 'node:net'
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, unlinkSync, openSync, closeSync, realpathSync, statSync } from 'node:fs'
import { dirname, resolve, extname, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { homedir, tmpdir } from 'node:os'
import { createHash } from 'node:crypto'
import { spawn } from 'node:child_process'
import { parseArgs } from 'node:util'

const script = fileURLToPath(import.meta.url)
const root = resolve(dirname(script), '..')
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'))
const { values, positionals } = parseArgs({ allowPositionals: true, options: {
  host: { type: 'string' }, port: { type: 'string' }, backend: { type: 'string' },
  config: { type: 'string' }, version: { type: 'boolean' }, help: { type: 'boolean' },
} })
if (values.version) { console.log(pkg.version); process.exit(0) }
if (values.help || positionals.length !== 2 || positionals[0] !== 'server' || !['start', 'run', 'stop', 'restart', 'status'].includes(positionals[1])) {
  console.log('courseware-web server <start|run|stop|restart|status> [--host 127.0.0.1] [--port 8817] [--backend http://127.0.0.1:8008] [--config path]\ncourseware-web --version')
  process.exit(values.help ? 0 : 1)
}
const configPath = resolve(values.config || process.env.CW_WEB_CONFIG_FILE || resolve(homedir(), '.farfarfun/courseware/frontend/config.json'))
const configDir = dirname(configPath)
const socketPath = resolve(tmpdir(), `courseware-web-${process.getuid()}-${createHash('sha256').update(configPath).digest('hex').slice(0, 16)}.sock`)
const delay = ms => new Promise(done => setTimeout(done, ms))

function control(action) {
  return new Promise((done, reject) => {
    const socket = net.createConnection(socketPath)
    let data = ''
    socket.setTimeout(1500, () => socket.destroy(new Error('Service control timed out')))
    socket.on('connect', () => socket.write(action + '\n'))
    socket.on('data', chunk => { data += chunk })
    socket.on('end', () => {
      if (!data) { reject(Object.assign(new Error('Service stopped'), { code: 'ECONNRESET' })); return }
      try { done(JSON.parse(data)) } catch (error) { reject(error) }
    })
    socket.on('error', reject)
  })
}
async function status() {
  try { return await control('status') }
  catch (error) {
    if (['ENOENT', 'ECONNREFUSED', 'ECONNRESET'].includes(error.code)) return { running: false, config: configPath }
    throw error
  }
}
async function stop() {
  if (!(await status()).running) return
  await control('stop')
  for (let i = 0; i < 100; i++) {
    if (!(await status()).running) return
    await delay(100)
  }
  throw new Error('Service did not stop within 10 seconds')
}
function configuration() {
  mkdirSync(configDir, { recursive: true, mode: 0o700 })
  if (!existsSync(configPath)) {
    writeFileSync(configPath, JSON.stringify({ host: '127.0.0.1', port: 8817, backend: 'http://127.0.0.1:8008' }, null, 2) + '\n', { flag: 'wx', mode: 0o600 })
  }
  const saved = JSON.parse(readFileSync(configPath, 'utf8'))
  const config = { host: values.host || saved.host, port: Number(values.port || saved.port), backend: values.backend || saved.backend }
  const backend = new URL(config.backend)
  if (!['http:', 'https:'].includes(backend.protocol) || backend.username || backend.password || backend.pathname !== '/' || backend.search || backend.hash) throw new Error('backend must be an HTTP(S) origin without credentials or a path')
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) throw new Error('Invalid port')
  return config
}
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.webp': 'image/webp', '.woff2': 'font/woff2' }
async function run(config) {
  if ((await status()).running) throw new Error('Service already running')
  const dist = realpathSync(resolve(root, 'dist'))
  if (!existsSync(resolve(dist, 'index.html'))) throw new Error('Built frontend is missing')
  const upstream = new URL(config.backend)
  const proxy = upstream.protocol === 'https:' ? https : http
  const server = http.createServer((req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Cache-Control', 'no-store')
    let pathname
    try { pathname = new URL(req.url, 'http://localhost').pathname }
    catch { res.writeHead(400); res.end(); return }
    if (['/api', '/courses', '/health'].some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'))) {
      const headers = { ...req.headers, host: upstream.host }
      delete headers['x-forwarded-for']; delete headers['x-forwarded-host']; delete headers['x-forwarded-proto']
      const forwarded = proxy.request({ hostname: upstream.hostname, port: upstream.port || (upstream.protocol === 'https:' ? 443 : 80), method: req.method, path: req.url, headers }, response => {
        res.writeHead(response.statusCode, response.headers)
        response.pipe(res)
        response.on('error', () => res.destroy())
      })
      forwarded.setTimeout(30000, () => forwarded.destroy())
      forwarded.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('Backend unavailable') })
      req.on('aborted', () => forwarded.destroy())
      res.on('close', () => { if (!res.writableEnded) forwarded.destroy() })
      req.pipe(forwarded)
      return
    }
    if (!['GET', 'HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return }
    if (pathname === '/version.json') {
      res.setHeader('Content-Type', 'application/json')
      res.end(req.method === 'HEAD' ? undefined : JSON.stringify({ name: pkg.name, version: pkg.version }))
      return
    }
    try {
      const decoded = decodeURIComponent(pathname)
      if (decoded.includes('\\') || decoded.includes('\0') || decoded.split('/').includes('..')) { res.writeHead(404); res.end(); return }
      let file = resolve(dist, '.' + decoded)
      if (!existsSync(file) || statSync(file).isDirectory()) {
        if (extname(decoded) || decoded.startsWith('/assets/')) { res.writeHead(404); res.end(); return }
        file = resolve(dist, 'index.html')
      }
      file = realpathSync(file)
      if (!file.startsWith(dist + sep)) { res.writeHead(404); res.end(); return }
      res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream')
      res.setHeader('Content-Length', statSync(file).size)
      if (req.method === 'HEAD') res.end()
      else createReadStream(file).on('error', () => res.destroy()).pipe(res)
    } catch { res.writeHead(404); res.end() }
  })
  await new Promise((done, reject) => { server.once('error', reject); server.listen(config.port, config.host, done) })
  const info = { running: true, pid: process.pid, version: pkg.version, config: configPath, host: config.host, port: config.port, backend: config.backend }
  let stopping = false
  const controller = net.createServer(socket => {
    socket.setTimeout(1500, () => socket.destroy())
    socket.once('data', data => {
      const action = data.toString().trim()
      socket.end(JSON.stringify(info), () => { if (action === 'stop') shutdown() })
    })
  })
  function shutdown() {
    if (stopping) return
    stopping = true
    server.close(() => controller.close(() => process.exit(0)))
    setTimeout(() => { server.closeAllConnections(); process.exit(0) }, 5000).unref()
  }
  try {
    if (existsSync(socketPath)) unlinkSync(socketPath)
    await new Promise((done, reject) => { controller.once('error', reject); controller.listen(socketPath, done) })
    chmodSync(socketPath, 0o600)
  } catch (error) { server.close(); throw error }
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown)
  console.log(JSON.stringify(info))
}
async function main() {
  const action = positionals[1]
  if (action === 'status') { console.log(JSON.stringify(await status())); return }
  if (action === 'stop' || action === 'restart') { await stop(); if (action === 'stop') { console.log('Stopped'); return } }
  if ((await status()).running) throw new Error('Service already running')
  const config = configuration()
  if (action === 'run') { await run(config); return }
  const log = openSync(resolve(configDir, 'server.log'), 'a', 0o600)
  const child = spawn(process.execPath, [script, 'server', 'run', '--config', configPath, '--host', config.host, '--port', String(config.port), '--backend', config.backend], { detached: true, stdio: ['ignore', log, log] })
  closeSync(log)
  for (let i = 0; i < 100; i++) {
    const state = await status()
    if (state.pid === child.pid && state.running) { child.unref(); console.log(JSON.stringify(state)); return }
    if (child.exitCode !== null) throw new Error(`Startup failed; see ${configDir}/server.log`)
    await delay(100)
  }
  child.kill('SIGTERM')
  throw new Error(`Startup timed out; see ${configDir}/server.log`)
}
main().catch(error => { console.error(error.message); process.exitCode = 1 })
