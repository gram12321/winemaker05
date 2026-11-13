---
name: playwright-e2e
description: Add or maintain focused Playwright browser coverage for stable user-visible application flows when Playwright is selected.
---

# Playwright Browser Tests

Confirm the project actually uses Playwright, its configuration, package manager, local server command, and available tests before running or editing them. Do not assume a checked-in suite or an offline-only application.

- Test observable user outcomes using accessible roles, labels, and text where possible.
- For canvas interactions, derive coordinates from the current canvas bounds and the relevant transform instead of hard-coding viewport points.
- Keep tests focused and deterministic. Cover core domain rules through appropriate unit or integration interfaces; use browser tests for important interactions and flows.
- Isolate any external or persisted test data according to the project's actual environment.
- Run the smallest relevant configured test; expand only when scope or the user request justifies it. If browser installation or setup is missing, report the gap or perform authorized setup.
- A live browser inspection can add visual evidence but does not replace checked-in tests. Report the exact checks and results.
