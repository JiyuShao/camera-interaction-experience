---
status: accepted
---

# Precompute particle positions from the source model

The experience stores its replaceable source model in local project assets but does not load that full GLB in visitors' browsers. A deterministic build step samples the configured model into a compact binary point set because the selected source has roughly 396,000 triangles and a 23 MB payload, while the visible experience needs geometry positions only. This trades arbitrary runtime model swapping for much faster startup and consistent mobile performance; replacing the model requires rerunning `pnpm assets:build`.
