import assert from 'node:assert/strict'
import { resolveAvailablePhase, resurfaceDismissedState } from '../policy.js'
import { UPDATE_PHASES } from '../state.js'

assert.equal(
  resolveAvailablePhase({
    targetVersion: '1.2.3',
    manual: false,
    skippedVersion: '1.2.3',
    deferredVersion: ''
  }),
  UPDATE_PHASES.SKIPPED
)

assert.equal(
  resolveAvailablePhase({
    targetVersion: '1.2.3',
    manual: false,
    skippedVersion: '',
    deferredVersion: '1.2.3'
  }),
  UPDATE_PHASES.DEFERRED
)

assert.equal(
  resolveAvailablePhase({
    targetVersion: '1.2.3',
    manual: true,
    skippedVersion: '1.2.3',
    deferredVersion: '1.2.3'
  }),
  UPDATE_PHASES.AVAILABLE
)

assert.equal(
  resurfaceDismissedState({ canInstall: false }),
  UPDATE_PHASES.AVAILABLE
)

assert.equal(
  resurfaceDismissedState({ canInstall: true }),
  UPDATE_PHASES.DOWNLOADED
)

console.log('electron updater policy tests passed')
