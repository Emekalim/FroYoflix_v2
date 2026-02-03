/**
 * Phase 4 Test Suite Runner
 * 
 * Runs all extension system tests and aggregates results
 */

import { runAllTests as testQueryCompatibility } from './query-compatibility.test.mjs'
import { runAllTests as testRegistry } from './registry.test.mjs'

async function main() {
  console.log('\n')
  console.log('╔══════════════════════════════════════════════════════════════╗')
  console.log('║                                                              ║')
  console.log('║             PHASE 4 EXTENSION SYSTEM TEST SUITE              ║')
  console.log('║                                                              ║')
  console.log('║  Tests:                                                      ║')
  console.log('║  1. Query Adapters & Backward Compatibility                 ║')
  console.log('║  2. Validation Functions                                    ║')
  console.log('║  3. Extension Registry & Routing                            ║')
  console.log('║                                                              ║')
  console.log('╚══════════════════════════════════════════════════════════════╝')
  console.log('\n')

  let totalPassed = 0
  let totalFailed = 0

  try {
    // Run query/compatibility tests
    const queryResults = await testQueryCompatibility()
    totalPassed += queryResults.passed
    totalFailed += queryResults.failed

    // Run registry tests
    const registryResults = await testRegistry()
    totalPassed += registryResults.passed
    totalFailed += registryResults.failed

    // Final summary
    console.log('\n')
    console.log('╔══════════════════════════════════════════════════════════════╗')
    console.log('║                     FINAL TEST SUMMARY                       ║')
    console.log('╠══════════════════════════════════════════════════════════════╣')
    console.log(`║ Total Tests Run:      ${String(totalPassed + totalFailed).padEnd(45)} ║`)
    console.log(`║ Passed:               ${String(totalPassed).padEnd(45)} ✅  ║`)
    console.log(`║ Failed:               ${String(totalFailed).padEnd(45)} ❌  ║`)
    console.log('╠══════════════════════════════════════════════════════════════╣')

    if (totalFailed === 0) {
      console.log('║                    ALL TESTS PASSED! 🎉                     ║')
    } else {
      console.log('║                  SOME TESTS FAILED! ⚠️                       ║')
    }

    console.log('╚══════════════════════════════════════════════════════════════╝')
    console.log('\n')

    process.exit(totalFailed > 0 ? 1 : 0)
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message)
    console.error(error.stack)
    process.exit(1)
  }
}

main()
