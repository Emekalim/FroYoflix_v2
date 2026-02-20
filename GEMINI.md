## Issue Documentation Protocol

Whenever working on an issue, create or update a document following this structure:

### Issue Template

```markdown
### [Issue Number/Title]
> **Status**: **[IN PROGRESS / RESOLVED / BLOCKED]**
> **Resolution**: [One-line summary of how it was fixed, if resolved]
> **Implementation**: [Link to related code or docs if applicable]

**Issue Description:**
What is broken or not working as expected. Include how to reproduce it and the impact/severity.

**Symptoms:**
- What users observe
- Error messages
- When it occurs

**Technical Root Cause:**
- What debugging steps were performed
- What was discovered about the cause
- Key findings with specific file/line references

**Implemented Solution:**
- What fix was ultimately applied
- Code changes made with file paths
- Testing performed

**Lessons Learned:**
- What could prevent this in future
- Any gotchas discovered
```

### Status Tags
- **🔴 IN PROGRESS**: Currently being debugged or fixed
- **✅ RESOLVED**: Fixed and tested
- **🚫 BLOCKED**: Waiting on external dependency or decision

### Documentation Guidelines
- **Issue Type Routing**:
  - **Production Issues** (affects live users, data loss, critical functionality, or occurs in production mode): Document in `docs/production_known_issues.md`
  - **Regular Issues** (development bugs, non-critical features, or only occurs in developer/sandbox mode): Document in `docs/Known_Issues.md`
- Update the document after each work session on that issue
- Include specific file paths and line numbers with links when debugging
- Document failed approaches so they're not retried
- Always move to ✅ RESOLVED when the fix is complete and tested
- Add date stamps for follow-ups or version updates
- Link to implementation code references when applicable

---

## Improvements Documentation Protocol

Whenever working on a feature, optimization, or architectural improvement:

### Pre-Work Review
1. **Check the Improvements_Tracker.md** in the project's `docs/` folder first to see if the improvement exists
2. **Understand the original plan** by reviewing linked documentation
3. **Identify the current state** - is it Completed, Partial/In-Progress, or Future Roadmap?
4. **Note any constraints or blockers** from the tracker before starting work

### Improvement Template

```markdown
### [Improvement Title]
**Goal:** [What this improvement achieves]
-   **Plan:** [Link to related planning docs]
-   **Status:** **[COMPLETED / IN PROGRESS / PARTIAL]**.
-   **Key Implementations:**
    -   [What was built with file paths and links]
    -   [Architecture/design decisions made]
    -   [Performance metrics or measurements if applicable]
-   **Deviations:** [If approach differs from original plan, document why]
-   **Blockers/Trade-offs:** [Any constraints or compromises made]
-   **Related Issues/Dependencies:** [Links to related issues or dependent work]
```

### Documentation Guidelines for Improvements
- Review existing `docs/Improvements_Tracker.md` before starting any work
- **Create new entries** if the improvement doesn't exist, categorized as **Completed**, **Partial/In-Progress**, or add to **Future Roadmap**
- **Update after each session** - move items between sections (e.g., from "In-Progress" to "Completed" when done)
- Document **deviations from the original plan** with reasoning (e.g., performance concerns, tech stack changes)
- Include **specific file paths and line numbers** when referencing implementation
- Link to **related issues, PRs, or commits** when applicable
- Track **performance metrics** if the improvement involves optimization (e.g., "reduced API calls by 99%")
- Document **blockers or trade-offs** made during implementation (e.g., "seeking requires full file to write valid MP4 header")
- Add **date stamps** for major milestones or version updates
- If rolling back or pausing work, explain why and preserve code for future re-integration

---

## Session Handover Template

When creating a session summary or handover, use this format:

### Session Summary
- **What you were working on and what got done:** [describe work completed]
- **What worked and what didn't:** [include bugs and fixes]
- **Key decisions made and why:** [decision rationale]
- **Lessons learned and gotchas:** [important takeaways]
- **Clear next steps:** [what comes next]
- **Map of important files:** [key file locations and their purpose]

## Codebase navigation

This project uses `roam` for codebase comprehension. Always prefer roam over Glob/Grep/Read exploration.

Before modifying any code:
1. First time in the repo: `roam understand` then `roam tour`
2. Find a symbol: `roam search <pattern>`
3. Before changing a symbol: `roam preflight <name>` (blast radius + tests + fitness)
4. Need files to read: `roam context <name>` (files + line ranges, prioritized)
5. Debugging a failure: `roam diagnose <name>` (root cause ranking)
6. After making changes: `roam diff` (blast radius of uncommitted changes)

Additional: `roam health` (0-100 score), `roam impact <name>` (what breaks),
`roam pr-risk` (PR risk), `roam file <path>` (file skeleton).

Run `roam --help` for all commands. Use `roam --json <cmd>` for structured output.
# Project Architecture

## Project Overview

- **Files:** 294
- **Symbols:** 2102
- **Edges:** 3840
- **Languages:** javascript (92), svelte (79), markdown (34), json (15), yaml (9), typescript (8), java (4), css (3)

## Directory Structure

| Directory | Files | Primary Language |
|-----------|-------|------------------|
| `common/` | 178 | svelte |
| `capacitor/` | 37 | javascript |
| `docs/` | 27 | markdown |
| `electron/` | 16 | javascript |
| `.github/` | 12 | yaml |
| `./` | 9 | json |
| `patches/` | 5 |  |
| `extensions/` | 5 | json |
| `client/` | 5 | javascript |

## Entry Points

- `capacitor/src/main/app.js`
- `common/modules/providers/index.js`
- `common/modules/resolver/index.js`
- `common/modules/tmdb/index.js`
- `electron/src/main/app.js`

## Key Abstractions

Top symbols by importance (PageRank):

| Symbol | Kind | Location |
|--------|------|----------|
| `map map(data, mediaType)` | method | `common/modules/providers/tmdb/mapper.js:16` |
| `includes function includes(value1, value2)` | function | `common/components/CustomDropdown.svelte:43` |
| `App class App` | class | `electron/src/main/app.js:20` |
| `TorrentClient class TorrentClient extends WebTorrent` | class | `client/core/webtorrent.js:17` |
| `set function set(userID, cache, key, value)` | function | `common/modules/cache.js:120` |
| `resolve async resolve(filename)` | method | `common/modules/resolver/index.js:46` |
| `AnilistClient class AnilistClient` | class | `common/modules/anilist.js:155` |
| `Helper class Helper` | class | `common/modules/helper.js:14` |
| `click function click(node, cb = noop)` | function | `common/modules/click.js:60` |
| `close function close()` | function | `common/modals/details/DetailsModal.svelte:57` |
| `Debug class Debug` | class | `capacitor/src/main/debugger.js:25` |
| `isValidNumber function isValidNumber(value)` | function | `common/modules/util.js:41` |
| `App class App` | class | `capacitor/src/main/app.js:17` |
| `error console.error = function(...args)` | function | `common/modules/debug.js:25` |
| `send async send(type, data, transfer)` | method | `common/modules/torrent.js:40` |

## Architecture

- **Dependency layers:** 20
- **Cycles (SCCs):** 21
- **Layer distribution:** L0: 1012 symbols, L1: 205 symbols, L2: 160 symbols, L3: 140 symbols, L4: 48 symbols

## Testing

**Test directories:** `capacitor/android/app/src/test/`, `common/modules/__tests__/`, `common/modules/extensions/__tests__/`, `common/modules/providers/__tests__/`, `common/modules/resolver/__tests__/`
- **Test files:** 17
- **Source files:** 277
- **Test-to-source ratio:** 0.06

## Coding Conventions

Follow these conventions when writing code in this project:

- **Functions:** Use `camelCase` (83% of 555 functions)
- **Classes:** Use `PascalCase` (100% of 59 classes)
- **Imports:** Prefer absolute imports (100% are cross-directory)
- **Test files:** *.test.*

## Complexity Hotspots

Average function complexity: 11.4 (1152 functions analyzed)

Functions with highest complexity (consider refactoring):

| Function | Complexity | Location |
|----------|-----------|----------|
| `resolveFileAnime` | 426 | `common/modules/anime/animeresolver.js:355` |
| `handleMessage` | 392 | `client/core/webtorrent.js:439` |
| `filterTags` | 357 | `common/components/CustomDropdown.svelte:48` |
| `load` | 323 | `common/modals/details/components/EpisodeList.svelte:95` |
| `handleFiles` | 263 | `common/components/MediaHandler.svelte:841` |
| `fallbackSearch` | 221 | `common/modules/anilist.js:916` |
| `findInCurrent` | 187 | `common/components/MediaHandler.svelte:63` |
| `getPaginatedMediaList` | 187 | `common/modules/helper.js:268` |
| `setHash` | 176 | `common/modules/anime/animehash.js:29` |
| `createSections` | 176 | `common/modules/sections.js:498` |

## Domain Keywords

- **Package:** froyo
- **Description:** Manage your personal media library, organize your collection, and stream your content in real time, no waiting required!
- **Top domain terms:** media, progress, search, torrent, extension, episodes, episode, anime, extensions, entry, cache, play, provider, file, user, calculate, results, source, notifications, authenticated

## Core Modules

Most-imported modules (everything depends on these):

| Module | Imported By | Symbols Used |
|--------|-------------|--------------|
| `capacitor/src/main/debugger.js` | 67 files | 151 |
| `common/modules/cache.js` | 66 files | 238 |
| `common/components/CustomDropdown.svelte` | 61 files | 122 |
| `common/modules/util.js` | 55 files | 202 |
| `common/modules/click.js` | 47 files | 61 |
| `common/modules/settings.js` | 47 files | 69 |
| `common/modules/providers/tmdb/mapper.js` | 46 files | 83 |
| `common/modules/anilist.js` | 45 files | 100 |
| `common/types.d.ts` | 40 files | 63 |
| `common/modules/navigation.js` | 36 files | 65 |