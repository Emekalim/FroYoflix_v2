import assert from 'node:assert/strict'

import {
  captureRepairSignals,
  consumeIntentionalStop,
  createRepairState,
  noteForcedCorruptionKill,
  shouldAttemptRepair
} from '../transcode-repair-policy.js'

{
  const hash = 'single-audio-stop'
  const intentionalStops = new Set([hash])
  const intentionalStop = consumeIntentionalStop(intentionalStops, hash)

  assert.equal(intentionalStop, true)
  assert.equal(intentionalStops.has(hash), false)
  assert.equal(shouldAttemptRepair({
    intentionalStop,
    isRetry: false,
    useRepaired: false,
    repairState: createRepairState()
  }), false)
}

{
  const hash = 'multi-audio-stop'
  const intentionalStops = new Set([hash])
  const intentionalStop = consumeIntentionalStop(intentionalStops, hash)
  const repairState = createRepairState()
  captureRepairSignals(repairState, 'Error submitting packet to decoder')

  assert.equal(intentionalStop, true)
  assert.equal(intentionalStops.has(hash), false)
  assert.equal(shouldAttemptRepair({
    intentionalStop,
    isRetry: false,
    useRepaired: false,
    repairState
  }), false)
}

{
  const repairState = createRepairState()
  captureRepairSignals(repairState, 'Error submitting packet to decoder')
  noteForcedCorruptionKill(repairState)

  assert.equal(repairState.sawDecoderFailure, true)
  assert.equal(repairState.forcedDecoderKillForCorruption, true)
  assert.equal(shouldAttemptRepair({
    intentionalStop: false,
    isRetry: false,
    useRepaired: false,
    repairState
  }), true)
}

{
  const repairState = createRepairState()
  captureRepairSignals(repairState, 'Invalid data found when processing input')

  assert.equal(repairState.sawInvalidData, true)
  assert.equal(shouldAttemptRepair({
    intentionalStop: false,
    isRetry: false,
    useRepaired: false,
    repairState
  }), true)
}

{
  assert.equal(shouldAttemptRepair({
    intentionalStop: false,
    isRetry: false,
    useRepaired: false,
    repairState: createRepairState()
  }), false)
}

{
  const repairState = createRepairState()
  captureRepairSignals(repairState, 'Error submitting packet to decoder')

  assert.equal(shouldAttemptRepair({
    intentionalStop: false,
    isRetry: true,
    useRepaired: false,
    repairState
  }), false)
}

{
  const repairState = createRepairState()
  captureRepairSignals(repairState, 'Invalid data found when processing input')

  assert.equal(shouldAttemptRepair({
    intentionalStop: false,
    isRetry: false,
    useRepaired: true,
    repairState
  }), false)
}

console.log('transcode repair policy tests passed')
