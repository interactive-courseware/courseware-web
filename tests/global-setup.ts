import { execFileSync } from 'node:child_process'

export default function setup() {
  execFileSync('python3', ['../../scripts/e2e-setup.py'], { stdio: 'inherit' })
}
