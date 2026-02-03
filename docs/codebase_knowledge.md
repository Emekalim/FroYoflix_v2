# Extensions Manager: Technical Blueprint

## Overview

The Extensions Manager (`manager.js`) is the core orchestration system for Shiru's plugin architecture. It handles the complete lifecycle of extensions: discovery, fetching, validation, initialization, caching, updating, and execution management.

**Architecture Pattern**: This is a **Manager/Mediator Pattern** implementation combined with **Strategy Pattern** for protocol handling. Think of it as a Python class that manages a registry of subprocess workers (similar to Python's `multiprocessing.Pool`).

---

## Core Concepts for Python Developers

### Web Workers = Isolated Python Processes

If you're familiar with Python's multiprocessing, JavaScript Web Workers are equivalent:
- Each extension runs in an **isolated thread** (Worker)
- They communicate via message passing (like `Queue` in Python)
- Main thread ≠ Worker thread (no shared memory by default)
- Communication library: **Comlink** (RPC wrapper for Workers)

### Async/Await = Python's `async def`

```javascript
// JavaScript
async function getExtension(name, url) {
  const code = await response.text()
}

# Python equivalent
async def get_extension(name, url):
    code = await response.text()
```

### Promises = Python's `asyncio.Future`

- `Promise` = `asyncio.Future` (represents eventual completion)
- `.then()` = `await` (wait for async operation)
- `Promise.all()` = `asyncio.gather()` (wait for multiple async operations)
- `Promise.allSettled()` = gather all without failing on single error

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      Main Thread (UI)                           │
│                   ExtensionManager Class                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Source Discovery & Manifest Loading                      │  │
│  │ - getManifest(url, updateCheck)                          │  │
│  │   • Supports: gh:, npm:, file:, extension:, http(s)      │  │
│  │   • Returns array of extension configs                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Extension Code Fetching & Transformation                │  │
│  │ - getExtension(name, url)                               │  │
│  │   • Resolves all protocol types to fetch code           │  │
│  │   • Handles ES module re-exports (esm.sh)              │  │
│  │   • Returns JavaScript string                           │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Cache Management                                         │  │
│  │ - cache.cachedEntry()  → store extension code           │  │
│  │ - cache.cacheEntry()   → retrieve from cache            │  │
│  │ - Expiration: 7-14 days (random)                        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Worker Creation & Management                            │  │
│  │ - createWorker(source)                                  │  │
│  │   • Instantiates new Web Worker                         │  │
│  │   • Wraps with Comlink for RPC                          │  │
│  │ - activeWorkers   → validated, working extensions       │  │
│  │ - inactiveWorkers → failed validation (offline?)        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Worker Threads (Extension Execution)                    │  │
│  │ ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │  │
│  │ │  Worker 1   │  │  Worker 2   │  │  Worker N   │       │  │
│  │ │ (Extension) │  │ (Extension) │  │ (Extension) │       │  │
│  │ └─────────────┘  └─────────────┘  └─────────────┘       │  │
│  │ (Runs: single(), batch(), movie(), test() methods)      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Key Classes & Data Structures

### `ExtensionManager` Class

**Instance Variables (Like Python class attributes):**

```javascript
// Python equivalent terminology:
this.pending = new Map()                    # dict[url: str, promise: Promise]
this.activeWorkers = {}                     # dict[key: str, RemoteWorker]
this.inactiveWorkers = {}                   # dict[key: str, RemoteWorker]
this.loadingExtensions = new Map()          # dict[key: str, promise: Promise]
this.whenReady = createDeferred()           # asyncio.Event()
```

**Constructor Behavior:**
1. Subscribes to `settings` (watch pattern, like Observable in Python)
2. When settings change, detects new sources
3. Calls `updateExtensions()` then `loadExtensions()`
4. Sets up "online" event listener to validate inactive workers

**Key Methods:**

| Method | Purpose | Python Analogy |
|--------|---------|-----------------|
| `isActive(key)` | Check if worker loaded & working | `dict.get(key)` lookup |
| `isInactive(key)` | Check if worker failed | `dict.get(key)` lookup |
| `validateExtension(key)` | Move worker from inactive → active | Move from failed queue to active pool |
| `reloadExtensions()` | Kill all workers, start fresh | `pool.terminate()` + `pool = Pool()` |
| `removeSource(extensionId)` | Delete extension & cleanup | Remove from registry |
| `addSource(url)` | Add new extension repository | Register new extension source |
| `loadExtensions(extensions, update)` | Initialize all workers | `pool.apply_async()` for each extension |
| `updateExtensions(current, sources)` | Check & apply updates | Check version compatibility |

---

## Protocol Handling: Multi-Strategy Pattern

The manager supports 5 different source protocols. Each is handled differently:

### 1. **HTTP/HTTPS Protocol**
```javascript
if (url.startsWith('http')) return await (await fetch(url)).json()
```
- Direct fetch from web URL
- Simplest case: just GET the URL

### 2. **Extension Protocol** (Local)
```javascript
if (url.startsWith('extension:')) return `${url}.js`
```
- Used for locally bundled extensions
- No fetch needed, returns file path reference

### 3. **GitHub Protocol** (`gh:`)
```javascript
// URL format: gh:owner/repo/path/to/file
const response = await fetch(`https://esm.sh/gh/${pathParts[0]}/${pathParts[1]}/es2022/${...}`)
```
- Transforms GitHub path to esm.sh CDN URL
- Example: `gh:emekalim/seadex-extension` → `https://esm.sh/gh/emekalim/seadex-extension/...`
- **Why esm.sh?** It's a CDN that converts Node.js packages to ES modules

### 4. **NPM Protocol** (`npm:`)
```javascript
// URL format: npm:package-name/path
const response = await fetch(`https://esm.sh/${pathParts[0]}/es2022/${...}`)
```
- Fetches from NPM packages via esm.sh
- Similar to GitHub but different URL structure

### 5. **File Protocol** (Local)
```javascript
// URL format: file:///absolute/path or C:\drive\path
const localeURL = `file:///${url.replace(/\\/g, '/')}`
```
- Reads manifest from local filesystem
- Handles Windows (`C:\`) and Unix paths

---

## Extension Source Resolution: Manifest System

### Manifest Structure

Every extension source provides a **manifest**: a JSON file describing what extensions are available.

**Example Manifest** (Array of objects):
```json
[
  {
    "id": "seadex",
    "name": "Seadex Extension",
    "version": "1.0.0",
    "main": "gh:emekalim/seadex-extension/sources/seadex.js",
    "update": "gh:emekalim/seadex-extension"
  }
]
```

**Two Manifest Types:**

1. **Repository Manifest** (List of available extensions)
   - Format: `[{id, name, version, main, update}, ...]`
   - Purpose: Source repository (like PyPI listing)
   - Has `main` field + no `update` field

2. **Extension Manifest** (Single extension definition)
   - Format: Same as above
   - Purpose: Individual extension from repository
   - May have `update` field (for checking new versions)

### Manifest Resolution Process

```
Input: Source URL (gh:owner/repo)
           ↓
[1] getManifest(url) called
           ↓
[2] Parse URL protocol
           ↓
[3] If gh:/npm:
    → Transform to esm.sh URL
    → Check if URL ends with .json
    → If not, append /index.json
           ↓
[4] Fetch manifest from URL
           ↓
[5] Validate:
    - Is it valid JSON?
    - Is it an array?
    - Do all entries have required fields?
           ↓
[6] Return array or null
```

---

## Extension Code Fetching: The "Re-export Problem"

### Why ESM.SH Complicates Things

When you request a module from esm.sh, sometimes it returns a **re-export wrapper** instead of actual code:

```javascript
// esm.sh might return this instead of actual code:
export * from "https://esm.sh/real-module"
export { default } from "https://esm.sh/real-module"
```

This is a redirect. The manager detects and resolves it:

```javascript
// getExtension() logic:
const code = await response.text()  // Get the response

// Check if it's a re-export:
if (code.includes('export * from') && code.includes('export { default } from')) {
  // Extract the real module URL from the re-export
  const match = code.match(/from\s+["']([^"']+)["']/)
  
  if (match && match[1]) {
    // Fetch the actual module
    const moduleResponse = await fetch(`https://esm.sh${match[1]}`)
    code = await moduleResponse.text()  // Use real code
  }
}
```

**Why this matters:** Without this logic, extensions would get re-export code instead of actual executable code, causing the 429 "Invalid relative url" error you saw in FroYoFlix.

---

## Caching Strategy

### Cache Purpose
Extensions can be large (~100KB+) and hosted on external CDNs. Caching them locally:
- Reduces network requests
- Enables offline mode (inactive workers can use cached code)
- Speeds up startup

### Cache Implementation

```javascript
// During loadExtensions():

// 1. Try to get from cache
const cachedModule = await cache.cachedEntry(caches.EXTENSIONS, key, true)

// 2. If cache miss or update needed, fetch from network
let newCode = await getExtension(extension?.name, extension?.main)

// 3. Store in cache (with expiration)
modules[key] = await cache.cacheEntry(
  caches.EXTENSIONS, 
  key, 
  { mappings: true },
  newCode,
  Date.now() + getRandomInt(7, 14) * 24 * 60 * 60 * 1_000  // 7-14 days
)

// 4. Fallback to cache if fetch fails
if (!newCode) {
  modules[key] = await cache.cachedEntry(caches.EXTENSIONS, key, true)
}
```

**Cache Key Structure:**
```javascript
key = (extension.locale || (extension.update + '/')) + extension.id

// Examples:
"gh:emekalim/seadex-extension/seadex"          // Network source
"extension:///local/path/seadex"                // Local extension
```

**Expiration:** Random 7-14 days (staggered to avoid mass-updating all extensions on same day)

---

## Worker Lifecycle Management

### State Transitions

```
[UNINITIALIZED]
       ↓
  createWorker() + wrap()
       ↓
[LOADING] ← initialize(key, code, options)
       ↓
   Validation check
       ↙        ↘
  ✓ PASS    ✗ FAIL
     ↓          ↓
[ACTIVE]   [INACTIVE]
  ↓              ↓
  ↓ (online event)
  ↓ validateExtension()
  ↓              ↓
  ←──────────────┘
```

### Active Workers Pool

**Python Analogy:**
```python
# JavaScript:
this.activeWorkers = {}  # Currently working extensions

# Python equivalent:
pool = multiprocessing.Pool(n_workers)
active_workers = {key: process for process in pool}
```

**Used for:**
- Searching content (calls `worker.single()`, `worker.batch()`)
- Batch operations (calls `worker.movie()`)
- Testing (calls `worker.test()`)

### Inactive Workers Pool

**Why extensions become inactive:**
1. Network unreachable during initialization
2. Manifest validation failed
3. Worker crashed during `initialize()`
4. Invalid extension code

**Inactive Worker Behavior:**
- Stored but not used for queries
- When network comes online, `window.addEventListener('online', ...)` triggers
- Attempts to re-validate: if successful, moves to `activeWorkers`
- If still fails, deleted from memory

---

## Update System

### Version Check Algorithm

```javascript
// updateExtensions() process:

1. Get all currently installed extensions
2. For each source URL in installed extensions:
   - Fetch latest manifest from source
   - Validate manifest structure
   
3. For each installed extension:
   - Find latest version in manifest
   - Compare: current.version vs latest.version
   - Compare: current.update vs latest.update
   
4. If any differ:
   - Terminate old worker
   - Update settings with new version
   - Re-initialize worker on next load

5. Also check extension source repositories for changes
```

**Key insight:** Uses `JSON.stringify()` to deep compare objects (equivalent to `==` for Python dicts)

```javascript
if (JSON.stringify(current) !== JSON.stringify(config))
  // Versions differ, update needed
```

---

## CORS & Android Workaround

### The CORS Problem

Cross-Origin Resource Sharing (CORS) prevents browser fetch requests to different domains in some scenarios, especially on Android.

### Solution: Request Proxying

```javascript
// Android workaround:
if (SUPPORTS.isAndroid && extension.trusted) {
  worker.onmessage = async (event) => this.portMessage(event, worker)
}

// portMessage() logic:
async portMessage(event, worker) {
  const { type, requestId, url, options } = event.data
  
  if (type === 'FETCH') {
    // Main thread makes the fetch (bypasses CORS)
    const response = await fetch(url, options)
    const text = await response.text()
    
    // Send result back to worker
    worker.postMessage({ 
      type: 'RESULT', 
      requestId, 
      ok: response.ok, 
      text 
    })
  }
}
```

**Flow:**
```
Worker          Main Thread        Network
  │                 │                │
  │─ FETCH msg ────→│                │
  │                 │─ fetch() ─────→│
  │                 │← response ─────│
  │← RESULT msg ────│                │
```

This is only enabled for "trusted" extensions on Android devices.

---

## Validation System

### Extension Configuration Validation

```javascript
validateConfig(config) {
  return config && typeof config === 'object' && 
    ['id', 'name', 'version', 'main', 'update'].every(prop => prop in config)
}
```

**Checks:**
- ✓ config is not null/undefined
- ✓ config is an object (not array, string, etc.)
- ✓ Has all 5 required fields: id, name, version, main, update

### Worker Validation

Worker sends validation result to main thread:
```javascript
const initialize = await remoteWorker.initialize(key, modules[key], options)

if (!initialize.validated) {
  this.inactiveWorkers[key] = remoteWorker  // Failed validation
  throw new Error(initialize.error)
}
```

The worker's `initialize()` method:
1. Loads the extension code
2. Creates extension instance
3. Calls `extension.test()` to validate
4. Returns `{validated: true/false, error: message}`

---

## Settings Integration

### Reactive Settings Pattern

The manager subscribes to `settings`, which triggers re-initialization:

```javascript
settings.subscribe(value => {
  const newSources = value.sourcesNew || {}
  const sourcesOld = Object.keys(sources || {})
  
  // Detect changes
  if (sourcesOld.length !== sourcesNew.length || 
      !sourcesOld.every(key => sourcesNew.includes(key))) {
    
    // Changes detected - update extensions
    this.updateExtensions(newSources, value.extensionSources)
      .then(update => this.loadExtensions(newSources, update))
  }
})
```

**Settings Data Structure:**
```javascript
{
  sourcesNew: {
    "key1": { id, name, version, main, update, locale?, trusted? },
    "key2": { ... }
  },
  extensionsNew: {
    "key1": { enabled: true/false },
    "key2": { ... }
  },
  extensionSources: {
    "gh:owner/repo": [manifest array],
    // ...
  }
}
```

---

## Error Handling Strategy

### Silent vs. Verbose Errors

```javascript
// During update check (silent on 429/503):
if (!updateCheck || !(error?.status === 429 || error?.status === 503)) {
  await printError(...)  // Show to user
}

// Rationale: 429/503 are rate limits, common during update checks
// Don't spam user with these, but show actual errors
```

### Fallback Chain

```
1. Try fetch from network
   ↓ if fails
2. Try load from cache
   ↓ if cache empty or invalid
3. Mark as inactive
   ↓ if user comes back online
4. Try validate again
   ↓ if still fails
5. Delete worker, show error
```

---

## Performance Optimizations

### 1. Deferred Initialization (Lazy Loading)

```javascript
// Only load extensions when needed
if (!modules[key]) {
  // Fetch from network or cache
  let newCode = await getExtension(...)
}
```

Extensions aren't created until first use.

### 2. Pending Request Deduplication

```javascript
async addSource(url) {
  if (this.pending.has(url)) 
    return this.pending.get(url)  // Return same promise
  
  const promise = (async () => {
    // ... fetch and process
  })()
  
  this.pending.set(url, promise)
}
```

If two requests to add same source happen simultaneously, they both wait for one fetch.

### 3. Promise.allSettled() for Parallel Loading

```javascript
const loadWorkers = Promise.allSettled(extensionIds.map(async (key) => {
  // Initialize each extension in parallel
}))

await loadWorkers
```

All extensions load in parallel, not sequentially. If one fails, others continue.

### 4. Random Cache Expiration

```javascript
Date.now() + getRandomInt(7, 14) * 24 * 60 * 60 * 1_000
```

Staggering expiration prevents all extensions updating on same day (cache stampede problem).

---

## Debugging & Logging

### Debug Module

```javascript
import Debug from 'debug'
const debug = Debug('ui:manager')

// Usage:
debug('Loading extensions from sources...')
debug(`Source repository updated: ${url}`)
debug(`Found ${toUpdate.length} extensions to update:`, toUpdate.map(...))
```

Enable debugging in browser console:
```javascript
localStorage.debug = 'ui:*'
```

### Error Reporting

```javascript
await printError(
  title,           // "Failed to load extension seadex"
  subtitle,        // "Initialization has failed"
  error            // { message, stack }
)
```

Shows in UI toast notification + console.

---

## Interaction with Other Modules

| Module | Interaction |
|--------|-------------|
| `settings.js` | Subscribes to detect source changes |
| `cache.js` | Stores/retrieves extension code |
| `networking.js` | Detects online/offline status, error reporting |
| `worker.js` | Message passing with extensions, sends back results |
| `support.js` | Detects Android for CORS workaround |
| `util.js` | Random int generation, deferred promises |

---

## Summary Table

| Concept | JavaScript | Python Equivalent | Purpose |
|---------|-----------|-------------------|---------|
| Web Worker | Isolated thread | `multiprocessing.Process` | Run extension in sandbox |
| Comlink | RPC wrapper | `multiprocessing.Queue` + proxy | Talk to Worker |
| Promise | Eventual result | `asyncio.Future` | Handle async operations |
| Map/Object | Key-value store | `dict` | Store workers by ID |
| Manifest | JSON metadata | Configuration file | Describe available extensions |
| Cache | Browser storage | File cache on disk | Store fetched extension code |
| Protocol Strategy | Protocol router | Strategy pattern | Handle different URL types |

---

## Key Takeaways

1. **Manifest-driven**: Everything starts with a JSON manifest describing what to load
2. **Multi-protocol**: Supports gh:, npm:, file:, extension:, and http(s) seamlessly
3. **Worker-based execution**: Each extension runs in isolated thread (safe isolation)
4. **Automatic updates**: Periodically checks for new versions across all sources
5. **Offline-friendly**: Caches everything, works with inactive workers when offline
6. **Error resilient**: Falls back to cache, retries on network recovery
7. **Parallel loading**: Initializes all extensions concurrently, not sequentially
8. **CORS handling**: Proxies requests on Android to bypass browser restrictions
