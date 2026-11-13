---
name: react-best-practices
description: Apply React component, data-flow, rendering, and performance guidance when developing or reviewing React code.
metadata:
  author: vercel
  version: "1.0.0"
---

# React Practices

Use only when React is part of the task. Inspect the installed version, existing component conventions, state ownership, and affected interaction before applying advice. The [04-sourced reference rules](rules/) include Next.js and server-specific material; use those rules only if the corresponding technology exists. Source metadata is in [metadata.json](metadata.json).

- Keep components focused on rendering and interaction, with domain rules owned outside the UI.
- Derive state during rendering where appropriate, use events for interaction-driven effects, and clean up subscriptions and listeners.
- Avoid request waterfalls when operations are independent. Investigate actual rendering or bundle problems before adding memoization or new dependencies.
- Verify meaningful interaction changes with a focused test or browser check using the project's configured tooling.

For details, start with [parallel async work](rules/async-parallel.md), [derived state](rules/rerender-derived-state-no-effect.md), [functional updates](rules/rerender-functional-setstate.md), or [event listeners](rules/client-event-listeners.md). The remaining rule files are on-demand references, not an instruction to apply every optimization.
