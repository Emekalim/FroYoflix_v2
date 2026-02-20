# README Design — 2026-02-18

## Approach
Option A: "Showcase + Developer Guide" — single root `README.md` serving both end users and contributors.

## Sections

1. **Hero** — logo, tagline, nav links, stat badges, legal notice, demo video
2. **Feature Overview** — icon list, screenshots grid
3. **Architecture Diagrams** — package graph, layer diagram, content resolution sequence, extension lifecycle
4. **Installation (Production)** — Windows, Linux, Android
5. **Development Setup** — Electron + Capacitor, with flowcharts
6. **Project Structure** — annotated directory tree
7. **Contributing & License**

## Diagrams
- Package dependency: `graph TD` Mermaid
- Layer architecture: `flowchart TD` Mermaid
- Content resolution: `sequenceDiagram` Mermaid
- Extension lifecycle: `flowchart TD` Mermaid
- Dev setup flows: `flowchart TD` for Electron + Capacitor

## Assets
All images from `.github/docs/assets/` — logo_filled.svg, app.webp, videoplayer.webp, search.webp, episodes.webp, schedule.webp, subtitles.webp, w2g.webp
