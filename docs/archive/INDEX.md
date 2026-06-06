# Archive Index

These are historical planning and analysis documents, kept for reference. They document the reasoning behind architectural decisions but are no longer active working documents.

## Multi-Media Extension Plan (Phases 1–5)

The MEDIA_EXTENSION_PLAN defines the overall roadmap for extending FroYo beyond anime to support TV shows and movies. The numbered PHASE_* files are the per-phase plans and completion records that were produced during that work.

| File | Phase/Feature | Description |
|------|---------------|-------------|
| [MEDIA_EXTENSION_PLAN.md](MEDIA_EXTENSION_PLAN.md) | Overview | Master plan for adding TV/movie support across all five phases, with provider abstraction and unified metadata layer. |
| [PHASE_1_2_IMPLEMENTATION.md](PHASE_1_2_IMPLEMENTATION.md) | Phase 1–2 | Step-by-step implementation guide for the provider abstraction layer and TMDB/Trakt integration. |
| [PHASE_1_COMPLETE.md](PHASE_1_COMPLETE.md) | Phase 1 | Completion record for Phase 1: files created, test results, and summary of the BaseProvider abstraction. |
| [PHASE_2_SETUP.md](PHASE_2_SETUP.md) | Phase 2 | Setup instructions for Phase 2, including TMDB and Trakt API key configuration. |
| [PHASE_2_SETUP_COMPLETE.md](PHASE_2_SETUP_COMPLETE.md) | Phase 2 | Confirmation record that Phase 2 infrastructure (config system, providers) was ready for implementation. |
| [PHASE_3_IMPLEMENTATION_PLAN.md](PHASE_3_IMPLEMENTATION_PLAN.md) | Phase 3 | Plan and completion record for the title resolution system (anime, TV, and movie filename parsers). |
| [PHASE_4_IMPLEMENTATION_PLAN.md](PHASE_4_IMPLEMENTATION_PLAN.md) | Phase 4 | Plan for updating the extension system to support multiple media types with backward compatibility. |
| [PHASE_5_IMPLEMENTATION_PLAN.md](PHASE_5_IMPLEMENTATION_PLAN.md) | Phase 5 | Plan for adapting the UI to expose multi-media provider routing (search tabs, card routing). |
| [PHASE_5_CACHING_GUIDE.md](PHASE_5_CACHING_GUIDE.md) | Phase 5 | Checklist of caching integration points that Phase 5 tasks must respect to stay consistent with the existing IndexedDB layer. |
| [PHASE_5_TASK_1_COMPLETE.md](PHASE_5_TASK_1_COMPLETE.md) | Phase 5 / Task 1 | Completion record for the `mediaType.js` reactive store (Anime/TV/Movie selection with cache persistence). |
| [PHASE_5_TASK_2_COMPLETE.md](PHASE_5_TASK_2_COMPLETE.md) | Phase 5 / Task 2 | Completion record for the `MediaTypeTabs.svelte` tab-selector UI component. |
| [PHASE_5_TASK_3_COMPLETE.md](PHASE_5_TASK_3_COMPLETE.md) | Phase 5 / Task 3 | Completion record for multi-media provider routing in `sections.js` (search dispatch to AniList or TMDB). |

## TMDB Compatibility Work

| File | Phase/Feature | Description |
|------|---------------|-------------|
| [TMDB_COMPATIBILITY_ANALYSIS.md](TMDB_COMPATIBILITY_ANALYSIS.md) | TMDB / Analysis | Root-cause analysis of UI errors when displaying TMDB results due to missing AniList-specific data fields. |
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | TMDB / Fix | Phased implementation plan for making the details modal and card components safe against missing TMDB fields. |
| [CHECKLIST.md](CHECKLIST.md) | TMDB / Fix | Quick line-level checklist of every file change required to make TMDB results display correctly. |
| [UI_DISPLAY_LOGIC_ANALYSIS.md](UI_DISPLAY_LOGIC_ANALYSIS.md) | TMDB / UI | Analysis of the existing format-based conditional rendering patterns and how they can be reused for TV/movie display. |
| [TRAILER_FEATURE_REVIEW.md](TRAILER_FEATURE_REVIEW.md) | TMDB / Trailers | Review of the existing YouTube trailer feature (AniList) and the changes needed to support TMDB trailer data. |

## HLS / Local Transcoding

| File | Phase/Feature | Description |
|------|---------------|-------------|
| [HLS_CACHING_PLAN.md](HLS_CACHING_PLAN.md) | HLS / Plan | Architecture proposal for migrating local transcoding from a direct stream pipe to HLS segment caching with FFmpeg. |
| [hls_migration_debrief.md.resolved](hls_migration_debrief.md.resolved) | HLS / Debrief | Post-implementation technical debrief for the HLS migration, covering decisions made, constraints hit, and lessons learned. |

## Extension Sources

| File | Phase/Feature | Description |
|------|---------------|-------------|
| [PIRATE_BAY_IMPLEMENTATION_PLAN.md](PIRATE_BAY_IMPLEMENTATION_PLAN.md) | Extensions | Implementation plan for formatting PirateBay extension queries to correctly handle anime, TV, and movie search terms. |

## Infrastructure & Architecture

| File | Phase/Feature | Description |
|------|---------------|-------------|
| [CACHING_ARCHITECTURE.md](CACHING_ARCHITECTURE.md) | Caching | Comprehensive reference for the two-layer (in-memory + IndexedDB) caching architecture, written to inform Phase 5+ development. |
| [FORMAT_DROPDOWN_REFACTOR_PLAN.md](FORMAT_DROPDOWN_REFACTOR_PLAN.md) | UI Refactor | Plan to consolidate the redundant Anime/TV/Movies tabs into a single format filter dropdown with a unified control point. |
