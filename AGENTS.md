# AGENTS.md

## Rules
- Before writing code involving state management, or solidjs-specifics, you MUST read https://docs.solidjs.com/llms.txt and any linked files relating to the current task.
- Use latest stable versions of packages were possible.
- Read official docs for packages and tooling instead of guessing.
- Code quality is paramount. No short-term hacks, do it properly even if it requires changing other parts of the codebase.

## Commands

Check package.json for commands.

## Architecture

- **SolidJS** SPA + **@solidjs/router** + **Vite** + **CSS Modules**
- No backend — data persists via `localStorage`
- **PWA** via `vite-plugin-pwa` (autoUpdate service worker)
