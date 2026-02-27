import { describe, it, expect } from 'vitest'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import os from 'os'

const SCRIPT_PATH = path.resolve(import.meta.dirname, '../.github/scripts/refactor-gate.js')

interface GateResult {
  envVars: Record<string, string>
  stdout: string
}

function runGate(opts: {
  score?: number | null
  mockPrCount?: number
  mockLastMergeLabel?: string
}): GateResult {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'refactor-gate-test-'))
  const ghEnvPath = path.join(tmpDir, 'GITHUB_ENV')
  fs.writeFileSync(ghEnvPath, '')

  if (opts.score !== null && opts.score !== undefined) {
    fs.writeFileSync(path.join(tmpDir, 'health-score.txt'), String(opts.score))
  }

  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    GITHUB_ENV: ghEnvPath,
  }

  if (opts.mockPrCount !== undefined) {
    env.MOCK_PR_COUNT = String(opts.mockPrCount)
  }

  if (opts.mockLastMergeLabel !== undefined) {
    env.MOCK_LAST_MERGE_LABEL = opts.mockLastMergeLabel
  }

  const stdout = execSync(`node ${SCRIPT_PATH}`, {
    cwd: tmpDir,
    env,
    encoding: 'utf-8',
  })

  const envContent = fs.readFileSync(ghEnvPath, 'utf-8')
  const envVars: Record<string, string> = {}
  for (const line of envContent.split('\n')) {
    const eq = line.indexOf('=')
    if (eq > 0) {
      envVars[line.slice(0, eq)] = line.slice(eq + 1)
    }
  }

  fs.rmSync(tmpDir, { recursive: true })
  return { envVars, stdout }
}

describe('refactor-gate.js', () => {
  it('should set NEEDS_REFACTOR=false when score >= 80 and no open PRs', () => {
    const { envVars } = runGate({ score: 85, mockPrCount: 0, mockLastMergeLabel: 'none' })
    expect(envVars.HEALTH_SCORE).toBe('85')
    expect(envVars.NEEDS_REFACTOR).toBe('false')
  })

  it('should set NEEDS_REFACTOR=true when score < 80 and no open PRs', () => {
    const { envVars } = runGate({ score: 75, mockPrCount: 0, mockLastMergeLabel: 'none' })
    expect(envVars.HEALTH_SCORE).toBe('75')
    expect(envVars.NEEDS_REFACTOR).toBe('true')
  })

  it('should set NEEDS_REFACTOR=false when score < 80 but open PR exists (Healing Lock)', () => {
    const { envVars, stdout } = runGate({ score: 50, mockPrCount: 1, mockLastMergeLabel: 'none' })
    expect(envVars.HEALTH_SCORE).toBe('50')
    expect(envVars.NEEDS_REFACTOR).toBe('false')
    expect(stdout).toContain('Healing Lock')
  })

  it('should default to score 100 when health-score.txt is missing', () => {
    const { envVars } = runGate({ score: null, mockPrCount: 0, mockLastMergeLabel: 'none' })
    expect(envVars.HEALTH_SCORE).toBe('100')
    expect(envVars.NEEDS_REFACTOR).toBe('false')
  })

  it('should set NEEDS_REFACTOR=false when score is exactly 80', () => {
    const { envVars } = runGate({ score: 80, mockPrCount: 0, mockLastMergeLabel: 'none' })
    expect(envVars.NEEDS_REFACTOR).toBe('false')
  })

  it('should set NEEDS_REFACTOR=true when score is exactly 79', () => {
    const { envVars } = runGate({ score: 79, mockPrCount: 0, mockLastMergeLabel: 'none' })
    expect(envVars.NEEDS_REFACTOR).toBe('true')
  })

  it('should set NEEDS_REFACTOR=true when score is 0 and no open PRs', () => {
    const { envVars } = runGate({ score: 0, mockPrCount: 0, mockLastMergeLabel: 'none' })
    expect(envVars.HEALTH_SCORE).toBe('0')
    expect(envVars.NEEDS_REFACTOR).toBe('true')
  })

  it('should block when multiple open refactor PRs exist', () => {
    const { envVars } = runGate({ score: 30, mockPrCount: 3, mockLastMergeLabel: 'none' })
    expect(envVars.NEEDS_REFACTOR).toBe('false')
  })

  it('should default score to 100 when health-score.txt contains non-numeric value', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'refactor-gate-test-'))
    const ghEnvPath = path.join(tmpDir, 'GITHUB_ENV')
    fs.writeFileSync(ghEnvPath, '')
    fs.writeFileSync(path.join(tmpDir, 'health-score.txt'), 'not-a-number')

    const stdout = execSync(`node ${SCRIPT_PATH}`, {
      cwd: tmpDir,
      env: {
        ...(process.env as Record<string, string>),
        GITHUB_ENV: ghEnvPath,
        MOCK_PR_COUNT: '0',
        MOCK_LAST_MERGE_LABEL: 'none',
      },
      encoding: 'utf-8',
    })

    const envContent = fs.readFileSync(ghEnvPath, 'utf-8')
    fs.rmSync(tmpDir, { recursive: true })

    expect(envContent).toContain('HEALTH_SCORE=100')
    expect(envContent).toContain('NEEDS_REFACTOR=false')
    expect(stdout).toContain('non-numeric')
  })

  it('should silently skip when GITHUB_ENV is not set', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'refactor-gate-test-'))
    fs.writeFileSync(path.join(tmpDir, 'health-score.txt'), '90')

    const env = { ...(process.env as Record<string, string>), MOCK_PR_COUNT: '0' }
    delete (env as Record<string, string | undefined>).GITHUB_ENV

    // Should not throw — just does nothing when GITHUB_ENV is not set
    expect(() =>
      execSync(`node ${SCRIPT_PATH}`, { cwd: tmpDir, env, encoding: 'utf-8' }),
    ).not.toThrow()

    fs.rmSync(tmpDir, { recursive: true })
  })

  it('should set NEEDS_REFACTOR=false when last merged PR has ai-refactor label (loop prevention)', () => {
    const { envVars, stdout } = runGate({
      score: 50,
      mockPrCount: 0,
      mockLastMergeLabel: 'ai-refactor',
    })
    expect(envVars.HEALTH_SCORE).toBe('50')
    expect(envVars.NEEDS_REFACTOR).toBe('false')
    expect(stdout).toContain('Loop prevention')
  })

  it('should set NEEDS_REFACTOR=true when last merged PR has no ai-refactor label and score < 80', () => {
    const { envVars } = runGate({
      score: 60,
      mockPrCount: 0,
      mockLastMergeLabel: 'other-label',
    })
    expect(envVars.HEALTH_SCORE).toBe('60')
    expect(envVars.NEEDS_REFACTOR).toBe('true')
  })
})
