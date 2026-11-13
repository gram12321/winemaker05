---
name: shadcn-best-practices
description: Use for ShadCN component composition, accessibility, styling, and maintenance when the project actually uses ShadCN.
---

# ShadCN Practices

Use only for an existing or explicitly chosen ShadCN UI. Check the installed components, versions, `components.json`, aliases, and local design conventions before applying these 04-sourced tools. Do not assume ShadCN, Radix, Tailwind, or Lucide is part of Winemaker05.

- Reuse installed primitives and preserve local component changes. Keep forms, overlays, focus, labels, and validation accessible.
- Use the project's semantic tokens and component composition rather than imposing 04 styling or a preset.
- Consult the relevant [composition](rules/composition.md), [forms](rules/forms.md), [styling](rules/styling.md), and [icon](rules/icons.md) guidance.
- For an authorized component addition or update, consult [CLI guidance](cli.md) and [customization](customization.md); inspect proposed changes before overwriting local files. [MCP guidance](mcp.md) is optional when that capability is available.

Verify the affected interaction using the configured project checks and, for meaningful visual changes, a focused browser inspection.

## Updating Components

When a component update is requested:

1. Read the installed component, its callers, `components.json`, and any local customizations.
2. Use the applicable ShadCN CLI's `add <component> --dry-run` and `add <component> --diff` to inspect proposed files and changes; use `--view` when the upstream source needs closer review. See the [CLI guide](cli.md) for examples.
3. Merge the relevant upstream changes into the existing source, preserving local behavior and styling. Do not overwrite customized files or migrate presets without explicit direction.
4. Check imports, aliases, dependencies, accessibility, and affected interactions using the project's actual tooling.
