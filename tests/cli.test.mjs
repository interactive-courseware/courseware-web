import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import http from 'node:http'

const cli = resolve('bin/courseware-web.mjs')
const listen = server => new Promise(done => server.listen(0, '127.0.0.1', done))
test('packaged server lifecycle, SPA and authorized API/file proxy', async () => {
  const dir = mkdtempSync(resolve(tmpdir(), 'courseware-web-test-'))
  const config = resolve(dir, 'config.json')
  const backend = http.createServer((req, res) => {
    if (req.url === '/api/missing') { res.writeHead(404); res.end('not found'); return }
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Set-Cookie', 'cw_test=example; HttpOnly; SameSite=Lax')
    res.end(JSON.stringify({ origin: req.headers.origin, cookie: req.headers.cookie, range: req.headers.range, method: req.method }))
  })
  await listen(backend)
  const probe = http.createServer()
  await listen(probe)
  const port = probe.address().port
  await new Promise(done => probe.close(done))
  const origin = `http://127.0.0.1:${port}`
  function command(action, ...extra) {
    return spawnSync(process.execPath, [cli, 'server', action, '--config', config, ...extra], { cwd: tmpdir(), encoding: 'utf8', timeout: 15000 })
  }
  try {
    const start = command('start', '--port', String(port), '--backend', `http://127.0.0.1:${backend.address().port}`)
    assert.equal(start.status, 0, start.stderr)
    assert.equal(JSON.parse(command('status').stdout).running, true)
    assert.equal(command('start').status, 1)
    assert.equal((await fetch(origin + '/catalog')).status, 200)
    assert.equal((await fetch(origin + '/assets/missing.js')).status, 404)
    assert.equal((await fetch(origin + '/api/missing')).status, 404)
    assert.equal((await (await fetch(origin + '/version.json')).json()).name, '@farfarfun/courseware-web')
    const proxy = await fetch(origin + '/courses/demo/file', { headers: { Origin: 'http://external.example:18814', Cookie: 'cw_session=test', Range: 'bytes=0-10' } })
    assert.match(proxy.headers.get('set-cookie'), /HttpOnly/)
    assert.deepEqual(await proxy.json(), { origin: 'http://external.example:18814', cookie: 'cw_session=test', range: 'bytes=0-10', method: 'GET' })
    assert.equal((await fetch(origin + '/', { method: 'HEAD' })).headers.get('content-type'), 'text/html; charset=utf-8')
    assert.equal(command('stop').status, 0)
    assert.equal(JSON.parse(command('status').stdout).running, false)
  } finally {
    command('stop')
    await new Promise(done => backend.close(done))
    rmSync(dir, { recursive: true, force: true })
  }
})
