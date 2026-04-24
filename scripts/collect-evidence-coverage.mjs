import fs from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const outDir = path.join(root, '.evidence', 'dev70')
fs.mkdirSync(outDir, { recursive: true })

const files = [
  'screenshots/dev66/DEV-66-internal-tasks-parser-links.png',
  'screenshots/dev66/DEV-66-internal-leads-parser-links.png',
  'screenshots/dev66/DEV-66-internal-system-control-parser-links.png',
  'screenshots/dev67/DEV-67-internal-tasks-routing-hints.png',
  'screenshots/dev67/DEV-67-internal-leads-routing-hints.png',
  'screenshots/dev67/DEV-67-internal-system-control-routing-hints.png',
  'screenshots/dev68/DEV-68-internal-dashboard-focus-canonical.png',
  'screenshots/dev68/DEV-68-internal-tasks-focus-canonical.png',
  'screenshots/dev68/DEV-68-internal-system-control-focus-canonical.png',
  'screenshots/dev69/DEV-69-internal-dashboard-evidence-coverage.png',
  'screenshots/dev69/DEV-69-internal-system-control-evidence-coverage.png',
  'screenshots/dev69/DEV-69-opensource-dashboard-isolation.png',
  'screenshots/dev69/DEV-69-opensource-tasks-isolation.png',
  'screenshots/dev70/DEV-70-internal-dashboard-coverage.png',
  'screenshots/dev70/DEV-70-internal-leads-coverage.png',
  'screenshots/dev70/DEV-70-internal-system-control-coverage.png',
  'screenshots/dev70/DEV-70-opensource-dashboard-isolation.png',
  'screenshots/dev70/DEV-70-opensource-tasks-isolation.png',
]

const coverage = {
  dev_range: ['DEV-66', 'DEV-67', 'DEV-68', 'DEV-69', 'DEV-70'],
  pages: {
    dashboard: { internal: true, opensource: true },
    tasks: { internal: true, opensource: true },
    leads: { internal: true, opensource: false },
    system_control: { internal: true, opensource: false },
  },
  evidence: files.map((file) => ({ file, exists: fs.existsSync(path.join(root, file)) })),
  mode_isolation_files: [
    '.evidence/dev66/mode-isolation-opensource.json',
    '.evidence/dev67/mode-isolation-opensource.json',
    '.evidence/dev68/mode-isolation-opensource.json',
    '.evidence/dev69/mode-isolation-opensource.json',
    '.evidence/dev70/mode-isolation-opensource.json',
  ],
}

fs.writeFileSync(path.join(outDir, 'dev70-coverage-summary.json'), JSON.stringify(coverage, null, 2))

const markdown = `# DEV-70 Coverage Summary\n\n## pages\n- dashboard: internal=yes, opensource=yes\n- tasks: internal=yes, opensource=yes\n- leads: internal=yes, opensource=not-applicable\n- system_control: internal=yes, opensource=not-applicable\n\n## evidence_files\n${coverage.evidence.map((item) => `- ${item.exists ? 'ok' : 'missing'} ${item.file}`).join('\n')}\n\n## mode_isolation\n${coverage.mode_isolation_files.map((file) => `- ${file}`).join('\n')}\n`
fs.writeFileSync(path.join(outDir, 'dev70-coverage-summary.md'), markdown)
console.log('Wrote DEV-70 coverage summary')
