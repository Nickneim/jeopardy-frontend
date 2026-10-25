// Claude Code Stop hook (.claude/settings.json): runs build, lint and tests
// at the end of a turn, but only when the code changed since the last run.
// Silent when everything passes. On a failure it hands the errors back to
// Claude (decision: block), or, if Claude already got one more go because of
// this hook, shows them to the user instead, so it can't loop.
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

// The real path, with the disk's own casing: Claude Code can pass a
// lowercase drive (c:\...), and Vitest started from it loads a second copy
// of itself and fails every suite ("failed to find the current suite").
const ROOT = realpathSync.native(join(dirname(fileURLToPath(import.meta.url)), '..'))
const WATCHED_DIRS = ['src', 'scripts']
const WATCHED_FILES = [
  'package.json',
  'pnpm-lock.yaml',
  'vite.config.ts',
  'tsconfig.json',
  'tsconfig.app.json',
  'tsconfig.node.json',
  'eslint.config.js',
  'index.html',
]
const CHECKS = ['build', 'lint', 'test']
const STATE_FILE = join(ROOT, 'node_modules', '.cache', 'claude-stop-checks.json')
const OUTPUT_LINES = 60

function files(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? files(path) : [path]
  })
}

function fingerprint() {
  const paths = [
    ...WATCHED_DIRS.map(dir => join(ROOT, dir)).filter(existsSync).flatMap(files),
    ...WATCHED_FILES.map(file => join(ROOT, file)).filter(existsSync),
  ].sort()

  const hash = createHash('sha256')
  for (const path of paths) {
    const { size, mtimeMs } = statSync(path)
    hash.update(`${relative(ROOT, path)}:${size}:${mtimeMs}\n`)
  }
  return hash.digest('hex')
}

function readState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf8'))
  } catch {
    return {}
  }
}

function lastLines(text, count) {
  const plain = text.replace(/\x1b\[[0-9;]*m/g, '')
  return plain.trimEnd().split('\n').slice(-count).join('\n')
}

let input = {}
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}')
} catch {
  // No or bad input: treat it as a normal stop.
}

const current = fingerprint()
if (readState().fingerprint === current) {
  process.exit(0)
}

let failure = null
for (const check of CHECKS) {
  const result = spawnSync(`pnpm run ${check}`, {
    cwd: ROOT,
    shell: true,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0' },
  })

  if (result.status !== 0) {
    failure = {
      check,
      output: lastLines(`${result.stdout ?? ''}\n${result.stderr ?? ''}`, OUTPUT_LINES),
    }
    break
  }
}

// Remember this state either way: unchanged code isn't checked twice.
mkdirSync(dirname(STATE_FILE), { recursive: true })
writeFileSync(STATE_FILE, JSON.stringify({ fingerprint: current }))

if (!failure) {
  process.exit(0)
}

const message = `\`pnpm run ${failure.check}\` failed:\n\n${failure.output}`

console.log(JSON.stringify(input.stop_hook_active
  ? { systemMessage: `Stop checks still failing. ${message}` }
  : { decision: 'block', reason: `${message}\n\nFix this before finishing.` }))
