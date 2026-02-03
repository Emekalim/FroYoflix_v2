# Provider Tests

This folder contains comprehensive tests for the Phase 1 provider abstraction layer.

## Test Files

### `registry.test.mjs`
Tests the provider registry and factory pattern.
- Get all providers
- Get providers for media type
- Instantiate providers
- Verify caching

**Run:**
```bash
node registry.test.mjs
```

### `anilist.test.mjs`
Tests the AniList provider wrapper.
- Provider information
- Authentication status
- Required methods
- Search functionality (if authenticated)

**Run:**
```bash
node anilist.test.mjs
```

### `mal.test.mjs`
Tests the MyAnimeList provider wrapper.
- Provider information
- Authentication status
- Required methods
- Search functionality (if authenticated)

**Run:**
```bash
node mal.test.mjs
```

### `mappers.test.mjs`
Tests the data mappers for AniList and MyAnimeList.
- AniList mapper with mock data
- MyAnimeList mapper with mock data
- Consistency between mappers
- Unified Media model compliance

**Run:**
```bash
node mappers.test.mjs
```

### `run-all.mjs`
Runs all test suites and provides a summary.

**Run:**
```bash
node run-all.mjs
```

## Quick Start

### Run all tests:
```bash
cd /Users/franklin/Documents/Workspace/PersonalProjects/Shiru-6.4.8/common/modules/providers/__tests__
node run-all.mjs
```

### Run individual test:
```bash
node registry.test.mjs
node anilist.test.mjs
node mal.test.mjs
node mappers.test.mjs
```

## Expected Output

When all tests pass:
```
╔════════════════════════════════════════════════════════╗
║        SHIRU PROVIDER ABSTRACTION TEST SUITE           ║
╚════════════════════════════════════════════════════════╝

┌─ REGISTRY TESTS ──────────────────────────────────────┐
📋 Testing Provider Registry...
Test 1: Get all providers
  ✓ Found 2 providers: anilist, mal
...
✅ Registry tests passed!
└──────────────────────────────────────────────────────┘

... (more test output)

╔════════════════════════════════════════════════════════╗
║                  TEST SUMMARY                          ║
╠════════════════════════════════════════════════════════╣
║  Passed: 11/11 (100%)
╠════════════════════════════════════════════════════════╣
║  ✅ registry
║  ✅ instantiation
║  ✅ interface
║  ✅ anilistProvider
║  ✅ anilistSearch
║  ✅ malProvider
║  ✅ malSearch
║  ✅ anilistMapper
║  ✅ malMapper
║  ✅ mapperConsistency
║  ✅ ... (all passed)
╚════════════════════════════════════════════════════════╝
```

## Troubleshooting

### Module not found errors
- Ensure you're running from the correct directory
- Check that files are in `common/modules/providers/`

### "Cannot find module" for anilist.js or myanimelist.js
- These modules are lazily loaded by the providers
- Errors indicate existing modules may have moved or been renamed
- The test still passes if providers can be instantiated

### Permission denied
```bash
chmod +x run-all.mjs
```

## What Each Test Validates

| Test | Purpose |
|------|---------|
| Registry | Provider registry and factory pattern work correctly |
| Instantiation | Providers can be created and cached properly |
| Interface | All required methods exist on providers |
| AniList Provider | AniList wrapper loads and implements contract |
| MAL Provider | MyAnimeList wrapper loads and implements contract |
| AniList Mapper | AniList data correctly maps to unified model |
| MAL Mapper | MyAnimeList data correctly maps to unified model |
| Consistency | Both mappers produce compatible unified output |

## Integration with CI/CD

Add to your test suite:
```bash
node common/modules/providers/__tests__/run-all.mjs
```

Exit code 0 = all tests passed
Exit code 1 = at least one test failed
