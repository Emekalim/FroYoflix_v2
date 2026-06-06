import assert from 'node:assert/strict'
import {
  UPDATE_PHASES,
  createDefaultUpdaterState,
  getUpdaterPrimaryAction,
  shouldShowUpdateModal
} from '../updater-helpers.js'

const available = createDefaultUpdaterState({
  phase: UPDATE_PHASES.AVAILABLE,
  targetVersion: '1.2.3',
  canDownload: true
})

assert.equal(getUpdaterPrimaryAction(available).action, 'download')
assert.equal(shouldShowUpdateModal(available), true)

const deferred = createDefaultUpdaterState({
  phase: UPDATE_PHASES.DEFERRED,
  targetVersion: '1.2.3',
  canInstall: true
})

assert.equal(getUpdaterPrimaryAction(deferred).action, 'install')
assert.equal(shouldShowUpdateModal(deferred), false)

const manualError = createDefaultUpdaterState({
  phase: UPDATE_PHASES.ERROR,
  error: { stage: 'check', manual: true, message: 'network' }
})

assert.equal(shouldShowUpdateModal(manualError), true)

console.log('renderer updater tests passed')
