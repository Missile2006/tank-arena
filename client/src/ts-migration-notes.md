# Client TypeScript migration — stage 1

Converted runtime modules: `input`, `loop`, `sim/vector`, `sim/entity`, `render/canvas`, `events/bus`.
Their imports in remaining JavaScript modules point to `.ts`, so Vite uses TypeScript implementations at runtime.
Original `.js` modules are retained temporarily as rollback copies; remove them only after full migration and checks.

Validation from repository root:

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run dev:server
npm.cmd run dev:client
```

Test keyboard input, movement, room join, chat and rendering in the browser. Do not commit until verified.
