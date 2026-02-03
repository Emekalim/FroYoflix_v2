#!/usr/bin/env node
// @ts-check
/**
 * run-all.mjs - Run all resolver tests
 */

import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const tests = [
  { name: 'Parser Tests', file: 'parsers.test.mjs' },
  { name: 'Resolver Integration Tests', file: 'resolver.test.mjs' },
]

console.log('='.repeat(70))
console.log('RUNNING ALL RESOLVER TESTS')
console.log('='.repeat(70))
console.log()

let passedSuites = 0
let failedSuites = 0

async function runTest(test) {
  return new Promise((resolve) => {
    console.log(`\n${'='.repeat(70)}`)
    console.log(`Running: ${test.name}`)
    console.log('='.repeat(70))
    console.log()

    const proc = spawn('node', [join(__dirname, test.file)], {
      cwd: __dirname,
      stdio: 'inherit',
    })

    proc.on('close', (code) => {
      if (code === 0) {
        passedSuites++
      } else {
        failedSuites++
      }
      resolve()
    })
  })
}

;(async () => {
  for (const test of tests) {
    await runTest(test)
  }

  console.log(`\n${'='.repeat(70)}`)
  console.log('OVERALL TEST SUMMARY')
  console.log('='.repeat(70))
  console.log(`Test suites passed: ${passedSuites}/${tests.length}`)
  console.log(`Test suites failed: ${failedSuites}/${tests.length}\n`)

  if (failedSuites === 0) {
    console.log('✓ ALL TEST SUITES PASSED!')
    process.exit(0)
  } else {
    console.log(`✗ ${failedSuites} test suite(s) failed`)
    process.exit(1)
  }
})()
