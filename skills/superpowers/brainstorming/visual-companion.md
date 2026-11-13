# Local Visual Companion

This optional 04-derived tool presents a local HTML mockup or a small set of visual choices. Use it when seeing a layout, diagram, or visual alternative would materially help; a simple Mermaid diagram or the environment's built-in visualization may be enough. It is not a 05 UI implementation.

## Start

Node.js is required. From the repository root, start the server in a managed foreground or background process:

```sh
node skills/superpowers/brainstorming/scripts/server.cjs
```

The server binds to loopback and selects an available port. Its startup JSON reports `url`, `screen_dir`, and `state_dir`; give the user the URL when they need to inspect a screen. By default the session is created in the operating system's temporary directory. To choose another session directory, set `BRAINSTORM_DIR` before launching. Use a fresh directory; the server manages files within it.

## Present and collect feedback

1. Write a new uniquely named HTML file into `screen_dir`. The newest file is shown automatically; a fragment is wrapped in the supplied frame, while a complete document is served as written.
2. Keep the screen focused on the decision. Put selectable choices inside an `options` or `cards` container, for example `<div class="options"><button class="option" data-choice="a" onclick="toggleSelect(this)">Choice A</button></div>`. The supplied frame also styles `mockup` and `split`. Custom controls can record a selection with `window.brainstorm.choice(value, metadata)`.
3. Invite the user to inspect it. Read `state_dir/events` for recorded choice events and combine them with their explicit feedback. Click events use a `choice` field; programmatic choice events use `value`. A new screen clears the prior event file.
4. Stop the process when the visual session ends. The server also exits after inactivity. Session files are not automatically deleted; keep or remove them only as appropriate for the user's work.

The tool is for local collaboration. Do not expose it on a public interface, include secrets in screens, or treat a click as approval for external or irreversible actions.
