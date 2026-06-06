import assert from 'assert'
import { isElectronRuntime, shouldUseBuiltInSearchEngine } from '../runtime.js'

export async function testRuntimeDetection() {
  assert.strictEqual(isElectronRuntime({ IPC: { invoke: async () => {} }, electron: { getTranscoderPort: async () => 1 } }), true)
  assert.strictEqual(isElectronRuntime({ IPC: null, electron: null }), false)
  return true
}

export async function testFlagGating() {
  const runtime = { IPC: { invoke: async () => {} }, electron: { getTranscoderPort: async () => 1 } }
  assert.strictEqual(shouldUseBuiltInSearchEngine({ useBuiltInSearchEngine: true }, runtime), true)
  assert.strictEqual(shouldUseBuiltInSearchEngine({ useBuiltInSearchEngine: false }, runtime), false)
  assert.strictEqual(shouldUseBuiltInSearchEngine({ useBuiltInSearchEngine: true }, {}), false)
  return true
}
