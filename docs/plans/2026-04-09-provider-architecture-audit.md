# Provider Architecture Audit

## Purpose and Constraints

### Mission
Build a native search subsystem that can add and evolve torrent providers without each new provider forcing query, ranking, parsing, and UI rules to be rewritten in multiple places.

### What Must Stay Stable
- Torrent modal contract and downstream parsing flow
- Desktop IPC boundary for live scraping and provider fetches
- Shared normalized torrent result shape
- Existing post-search dedupe and torrent selection pipeline

### What Must Stay Adaptable
- Provider roster per media type
- Query policy per provider and per media domain
- Ranking and display policy
- Health scoring and temporary provider suppression

### Current Pain Points
- Media-type routing and provider policy are coupled too tightly to ad hoc format checks
- Query generation is partly shared and partly re-invented inside adapters
- Ranking policy is global even when anime, TV, and movie need different control rules
- Provider addition currently means editing registry, adapter, and often ranking/query code with no explicit capability contract

## Nervous-System Decomposition

### Sensors
- User media selection from Details and torrent modal
- Media metadata from AniList, TMDB, MAL, and resolver state
- Provider responses, empty-result rates, parse failures, and fetch failures
- UI sort/filter changes

### Afferent Pathways
- `buildBuiltInSearchQuery(...)` normalizes media into search intent
- `searchWithBuiltInEngine(...)` fans out the intent to provider adapters
- Electron IPC transports intent into provider-side execution

### Integration Centers
- Query planner in `common/modules/search-engine/query-builder.js`
- Media-type and provider registry in `common/modules/search-engine/registry.js`
- Ranking and diversification policy in `common/modules/search-engine/result-ranking.js`
- Adapter execution layer in `electron/src/main/search-engine/`

### Efferent Pathways
- Provider fetch/search calls from Electron main process
- Normalized results returned to renderer
- UI ranking, filtering, and selection behavior

### Effectors
- Provider adapters such as `Nyaa`, `YTS`, `showRSS`, and `Torrent Downloads`
- Future provider health controls and ranking policy knobs
- Human operator choosing sort mode, batch mode, autoplay, and source preferences

## Recommended Target Architecture

### 1. Domain Router
Own media classification in one place.

Responsibilities:
- classify search intent into `anime | tv | movie`
- apply explicit overrides from `media.mediaType`
- treat non-TMDB AniList/MAL entries as anime by default

Why:
- routing errors are more damaging than ranking errors
- anime should not leak into general TV providers because an AniList item happens to use `format: TV`

### 2. Query Policy Layer
Move provider-independent search planning into one structured contract.

Target contract:
```js
{
  mediaType: 'anime' | 'tv' | 'movie',
  titles: string[],
  variantPlan: {
    single: [{ stageMode, terms }],
    batch: [{ stageMode, terms }],
    movie: [{ stageMode, terms }]
  },
  ids,
  resolution,
  exclusions,
  batch,
  movie
}
```

Rules:
- shared planner owns staged intent
- adapters execute the plan, not invent their own incompatible plan
- fallbacks are explicit and mode-specific
- batch mode only falls back if policy says so, never implicitly

### 3. Provider Capability Manifest
Every provider should advertise behavior instead of relying on scattered assumptions.

Recommended fields:
```js
{
  id,
  name,
  mediaTypes: ['anime'],
  queryModes: ['single', 'batch', 'movie'],
  rankingProfile: 'anime-specialist',
  supportsIds: ['imdb', 'tmdb'],
  fetchMode: 'html' | 'rss' | 'json',
  reliabilityClass: 'high' | 'medium' | 'low',
  specialization: 'anime' | 'tv' | 'movie' | 'general'
}
```

Benefits:
- registry can choose providers by policy, not hardcoded guesswork
- ranking can use declared specialization instead of one-off source bonuses
- UI can later expose provider preference controls without custom wiring

### 4. Adapter Boundary
Adapters should be small local controllers.

Adapter responsibilities:
- fetch source-specific data
- parse source-specific payloads
- normalize into FroYo result shape
- optionally filter obvious false positives using provider-local rules

Adapter non-responsibilities:
- deciding global media type
- inventing global fallback strategy
- global ranking policy
- UI-specific display rules

### 5. Ranking Policy Layer
Split ranking policy by media domain instead of forcing one generic sorter.

Recommended profiles:
- `anime`: relevance-first, specialist-dominant, no cross-source diversification by default
- `tv`: relevance-aware but still diversity-friendly
- `movie`: mixed relevance and source diversity

This keeps:
- anime close to the old Nyaa-first behavior
- TV/movie open to broader provider consolidation

## Provider Normalization Model

### Recommended Module Layout
```
common/modules/search-engine/
  query-builder.js
  registry.js
  result-ranking.js
  provider-policy.js
  provider-types.d.ts

electron/src/main/search-engine/
  index.js
  registry.js
  provider-health.js
  adapters/
    nyaa.js
    yts.js
    showrss.js
    torrentdownloads.js
```

### Suggested Provider Lifecycle
1. Domain router classifies the request
2. Provider policy selects candidate providers for that domain
3. Query planner emits staged query plans
4. Adapter executes the plan
5. Provider-local false positives are filtered
6. Results are normalized
7. Global ranking policy sorts according to the domain
8. UI renders, dedupes, and allows user choice

## Feedback Loops and Observability

### Fast Loop: Search Reflex
- Signal: user opens torrent modal
- Decision: classify media type, select providers, build query plan
- Actuator: execute providers in Electron
- Metric: time-to-first-result, empty-result rate, parse failure rate

### Medium Loop: Provider Health
- Signal: repeated fetch failures, empty results, parse mismatches
- Decision: mark provider as degraded or lower-confidence
- Actuator: temporary demotion or suppression
- Metric: successful search rate by provider and media type

### Slow Loop: Policy Tuning
- Signal: user complaints, wrong-result downloads, manual row selection behavior
- Decision: update ranking and provider selection policy
- Actuator: query-policy or ranking-profile changes
- Metric: wrong-download rate, click-through on top-ranked rows, source mix quality

## Failure Modes and Degradation Strategy

| Failure | Current Risk | Recommended Response |
|---|---|---|
| Media misclassified as TV instead of anime | anime flooded by general sources | central domain router with explicit source-aware rules |
| Adapter invents broader fallback than intended | noisy or surprising results | query planner owns fallback policy |
| Source becomes hostile or blocked | empty or delayed searches | provider health scoring and temporary suppression |
| One provider floods merged list | specialist results buried | domain-specific ranking and diversification rules |
| Provider-specific parsing drift | silent bad rows | adapter-local parser tests with fixture coverage |

## Phased Recommendation

### Phase 1
- keep current desktop engine
- centralize media classification
- formalize `variantPlan`
- separate anime ranking policy from TV/movie ranking policy

### Phase 2
- add `provider-policy.js`
- move source bonuses and diversification rules into named profiles
- add provider capability metadata

### Phase 3
- add provider health memory and degradation controls
- add structured logs for query term chosen, provider selected, and result counts
- optionally surface provider preference UI

### Phase 4
- allow future pluggable providers against the normalized contract
- keep execution local and bounded
- avoid resurrecting remote-code extension loading for search providers unless security and support policy are explicit

## Concrete Ideas for Future Provider Additions

When adding a new provider, the expected work should become:
1. add a capability manifest entry
2. add one adapter module
3. map it to a ranking profile
4. add parser fixtures
5. optionally add provider-local false-positive rules

It should not require:
- editing torrent modal UI logic
- changing global media-type routing
- rewriting search plan generation
- custom one-off ranking hacks outside the ranking layer

## Open Risks
- current provider selection is still registry-driven rather than policy-driven
- there is no persistent provider health model yet
- the result contract is normalized, but provider capability metadata is still implicit
- anime, TV, and movie currently share more infrastructure than policy, which is good, but they still need clearer domain boundaries as provider count grows
