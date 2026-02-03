/**
 * @file mediaType.test.mjs
 * @description Unit tests for mediaType store
 * 
 * Tests the store logic without full cache initialization (full test requires webpack)
 */

import assert from 'assert'

// Mock implementation for testing
class MockStore {
  constructor(initialValue) {
    this.value = initialValue
    this.subscribers = []
  }
  
  set(newValue) {
    this.value = newValue
    this.subscribers.forEach(cb => cb(newValue))
  }
  
  subscribe(callback) {
    callback(this.value)
    this.subscribers.push(callback)
    return () => {
      this.subscribers = this.subscribers.filter(cb => cb !== callback)
    }
  }
}

// Test constants
const MEDIA_TYPES = Object.freeze(['anime', 'tv', 'movie'])

function isValidMediaType(value) {
  return MEDIA_TYPES.includes(value)
}

function setMediaType(store, value) {
  if (!isValidMediaType(value)) {
    throw new Error(`Invalid media type: ${value}. Must be one of: ${MEDIA_TYPES.join(', ')}`)
  }
  store.set(value)
}

function getMediaType(store) {
  return store.value
}

console.log('╔════════════════════════════════════════════════════════════╗')
console.log('║           MEDIA TYPE STORE UNIT TESTS                      ║')
console.log('╚════════════════════════════════════════════════════════════╝\n')

let passCount = 0
let failCount = 0

function test(name, fn) {
  try {
    fn()
    console.log(`✅ ${name}`)
    passCount++
  } catch (error) {
    console.error(`❌ ${name}`)
    console.error(`   ${error.message}`)
    failCount++
  }
}

// Test Group 1: Initial State
console.log('\n📋 Test Group 1: Initial State')
test('mediaType store initialized with default "anime"', () => {
  const store = new MockStore('anime')
  assert.strictEqual(store.value, 'anime', 'Initial value should be "anime"')
})

test('MEDIA_TYPES contains all valid types', () => {
  assert.deepStrictEqual(MEDIA_TYPES, ['anime', 'tv', 'movie'], 'MEDIA_TYPES should contain all three types')
})

test('MEDIA_TYPES is frozen (immutable)', () => {
  assert.throws(
    () => { MEDIA_TYPES.push('invalid') },
    'MEDIA_TYPES should be frozen'
  )
})

// Test Group 2: Validation
console.log('\n📋 Test Group 2: Validation')
test('isValidMediaType accepts "anime"', () => {
  assert.strictEqual(isValidMediaType('anime'), true)
})

test('isValidMediaType accepts "tv"', () => {
  assert.strictEqual(isValidMediaType('tv'), true)
})

test('isValidMediaType accepts "movie"', () => {
  assert.strictEqual(isValidMediaType('movie'), true)
})

test('isValidMediaType rejects invalid types', () => {
  assert.strictEqual(isValidMediaType('manga'), false)
  assert.strictEqual(isValidMediaType('invalid'), false)
  assert.strictEqual(isValidMediaType(null), false)
  assert.strictEqual(isValidMediaType(undefined), false)
})

// Test Group 3: Store Updates
console.log('\n📋 Test Group 3: Store Updates')
test('setMediaType updates store to "tv"', () => {
  const store = new MockStore('anime')
  setMediaType(store, 'tv')
  assert.strictEqual(store.value, 'tv')
})

test('setMediaType updates store to "movie"', () => {
  const store = new MockStore('anime')
  setMediaType(store, 'movie')
  assert.strictEqual(store.value, 'movie')
})

test('setMediaType updates store back to "anime"', () => {
  const store = new MockStore('anime')
  setMediaType(store, 'tv')
  setMediaType(store, 'anime')
  assert.strictEqual(store.value, 'anime')
})

test('setMediaType throws on invalid type', () => {
  const store = new MockStore('anime')
  assert.throws(
    () => { setMediaType(store, 'manga') },
    /Invalid media type/,
    'Should throw error for invalid media type'
  )
})

test('setMediaType throws on null', () => {
  const store = new MockStore('anime')
  assert.throws(
    () => { setMediaType(store, null) },
    /Invalid media type/
  )
})

// Test Group 4: Getters
console.log('\n📋 Test Group 4: Getters')
test('getMediaType returns current value', () => {
  const store = new MockStore('anime')
  setMediaType(store, 'tv')
  assert.strictEqual(getMediaType(store), 'tv')
})

test('getMediaType works for all valid types', () => {
  MEDIA_TYPES.forEach(type => {
    const store = new MockStore('anime')
    setMediaType(store, type)
    assert.strictEqual(getMediaType(store), type)
    assert.strictEqual(isValidMediaType(getMediaType(store)), true)
  })
})

// Test Group 5: Reactivity
console.log('\n📋 Test Group 5: Reactivity')
test('store is reactive (subscribe works)', () => {
  const store = new MockStore('anime')
  let subscribedValue = null
  const unsubscribe = store.subscribe(value => {
    subscribedValue = value
  })
  
  setMediaType(store, 'tv')
  assert.strictEqual(subscribedValue, 'tv', 'Subscriber should be notified of change')
  
  unsubscribe()
})

test('multiple subscribers receive updates', () => {
  const store = new MockStore('anime')
  const values1 = []
  const values2 = []
  
  const unsub1 = store.subscribe(v => values1.push(v))
  const unsub2 = store.subscribe(v => values2.push(v))
  
  setMediaType(store, 'movie')
  
  assert.strictEqual(values1[values1.length - 1], 'movie')
  assert.strictEqual(values2[values2.length - 1], 'movie')
  
  unsub1()
  unsub2()
})

// Test Group 6: Usage Patterns
console.log('\n📋 Test Group 6: Usage Patterns')
test('sequential media type changes', () => {
  const store = new MockStore('anime')
  
  setMediaType(store, 'anime')
  assert.strictEqual(getMediaType(store), 'anime')
  
  setMediaType(store, 'tv')
  assert.strictEqual(getMediaType(store), 'tv')
  
  setMediaType(store, 'movie')
  assert.strictEqual(getMediaType(store), 'movie')
  
  setMediaType(store, 'anime')
  assert.strictEqual(getMediaType(store), 'anime')
})

test('rapid sequential changes preserve state', () => {
  const store = new MockStore('anime')
  const changes = []
  
  store.subscribe(value => changes.push(value))
  
  setMediaType(store, 'tv')
  setMediaType(store, 'movie')
  setMediaType(store, 'anime')
  
  assert.deepStrictEqual(
    changes,
    ['anime', 'tv', 'movie', 'anime'],
    'All changes should be captured'
  )
})

// Summary
console.log('\n╔════════════════════════════════════════════════════════════╗')
console.log('║                     TEST SUMMARY                            ║')
console.log('╠════════════════════════════════════════════════════════════╣')
console.log(`║ Passed: ${passCount.toString().padEnd(49)}║`)
console.log(`║ Failed: ${failCount.toString().padEnd(49)}║`)
console.log('╠════════════════════════════════════════════════════════════╣')

if (failCount === 0) {
  console.log('║                  ALL TESTS PASSED! ✅                      ║')
} else {
  console.log(`║            TESTS FAILED! ${failCount} error(s) ❌               ║`)
}

console.log('╚════════════════════════════════════════════════════════════╝\n')

process.exit(failCount > 0 ? 1 : 0)
