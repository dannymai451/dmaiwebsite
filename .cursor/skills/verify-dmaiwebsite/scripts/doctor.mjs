#!/usr/bin/env node
// Read-only check: our process is up, it owns 5199, it is this checkout's Vite dev server, and the page has rendered.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const scratch = '/tmp/verify-dmaiwebsite'
const url = 'http://127.0.0.1:5199/'
const lines = []

function fail(message) {
  console.error(`FAIL ${message}`)
  process.exit(1)
}

function ppidOf(pid) {
  const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8')
  const rest = stat.slice(stat.lastIndexOf(')') + 2).trim().split(/\s+/)
  return Number(rest[1])
}

function cmdline(pid) {
  return fs.readFileSync(`/proc/${pid}/cmdline`).toString('utf8').replace(/\0/g, ' ').trim()
}

function ownsRecordedPid(listener, recorded) {
  let pid = listener
  for (let i = 0; i < 20 && pid > 1; i += 1) {
    if (pid === recorded) return true
    pid = ppidOf(pid)
  }
  return pid === recorded
}

const pidFile = path.join(scratch, 'pid')
if (!fs.existsSync(pidFile)) fail(`missing ${pidFile}`)
const recorded = Number(fs.readFileSync(pidFile, 'utf8').trim())
if (!recorded) fail('pid file is empty')
if (!fs.existsSync(`/proc/${recorded}`)) fail(`recorded pid ${recorded} is not running`)
const recordedCmd = cmdline(recorded)
if (!recordedCmd.includes('5199')) fail(`recorded pid ${recorded} cmdline does not contain 5199: ${recordedCmd}`)
lines.push(`pid=${recorded}`)

let listeners = []
try {
  const output = execFileSync('lsof', ['-nP', '-iTCP:5199', '-sTCP:LISTEN', '-t'], { encoding: 'utf8' })
  listeners = output
    .trim()
    .split('\n')
    .map((value) => Number(value.trim()))
    .filter(Boolean)
} catch {
  fail('port 5199 is not listening')
}
if (listeners.length !== 1) fail(`expected one listener on 5199, found ${listeners.join(',') || 'none'}`)
const listener = listeners[0]
if (!ownsRecordedPid(listener, recorded)) {
  fail(`listener ${listener} is not pid ${recorded} and is not its child`)
}
const listenerCmd = cmdline(listener)
if (!listenerCmd.includes('vite') || !listenerCmd.includes('5199') || listenerCmd.includes('preview')) {
  fail(`listener is not the vite dev server on 5199: ${listenerCmd}`)
}
const cwd = fs.realpathSync(`/proc/${listener}/cwd`)
if (cwd !== fs.realpathSync(root)) fail(`listener cwd is ${cwd}, expected ${root}`)
lines.push(`listener=${listener}`)
lines.push('ancestor=ok')
lines.push('build=vite-dev')

const pageResponse = await fetch(url)
const html = await pageResponse.text()
if (pageResponse.status !== 200) fail(`GET / returned ${pageResponse.status}`)
if (!html.includes('id="root"')) fail('document has no id="root"')
if (!html.includes('<title>dmaiwebsite</title>')) fail('document title is not dmaiwebsite')
if (!html.includes('/src/main.jsx')) fail('document is not the vite dev entry /src/main.jsx')
if (!html.includes('/@vite/client')) fail('document is not being served by the vite dev client')
lines.push('http=200')
lines.push('root=ok')

const sourceResponse = await fetch(`${url}src/components/Hero.jsx`)
const source = await sourceResponse.text()
if (sourceResponse.status !== 200 || !source.includes("Hey! I'm Danny")) {
  fail('vite is not serving this checkout\'s Hero.jsx')
}
lines.push('source=ok')

const browser = await chromium.launch({ headless: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  const heading = page.getByRole('heading', { name: "Hey! I'm Danny", level: 1 })
  await heading.waitFor({ state: 'attached', timeout: 15000 })
  const box = await heading.boundingBox()
  if (!box || box.height < 1) fail('heading has no layout box')
  await page.waitForFunction(
    () => {
      const images = [...document.querySelectorAll('.hero-hoptimists img')]
      return images.length === 3 && images.every((image) => image.complete && image.naturalWidth > 0)
    },
    null,
    { timeout: 15000 },
  )
  await page.waitForFunction(
    () => {
      const intro = document.querySelector('.hero-intro')
      if (!intro) return false
      let opacity = 1
      for (let node = intro; node; node = node.parentElement) {
        opacity *= Number(getComputedStyle(node).opacity)
      }
      return opacity > 0.9
    },
    null,
    { timeout: 15000 },
  )
} finally {
  await browser.close()
}
lines.push('render=ok')
lines.push('READY')
console.log(lines.join('\n'))
