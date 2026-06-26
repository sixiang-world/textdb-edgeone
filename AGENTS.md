# TextDB EdgeOne

EdgeOne Pages + KV 在线文本数据库。匿名写入/读取，无用户系统。

## Commands

```bash
npm run build        # tsc -b && vite build && node build-edge.cjs (3 steps)
npm run dev          # Vite dev server
npm run lint         # eslint .
npm run format       # prettier --write "**/*.{ts,tsx}"
npm run typecheck    # tsc --noEmit
```

**No test suite exists.** `npm run lint` + `npm run typecheck` 是唯一的 CI 验证。

## Architecture

- **前端**: React 19 + Vite + Tailwind CSS v4 + shadcn/ui (radix-nova style)
- **后端**: EdgeOne Edge Functions (V8 runtime) + KV (global `TEXTDB`)
- **部署**: GitHub push → auto-deploy (no CLI deploy). `functions/` and `edge-functions/` are build artifacts

`build-edge.cjs` inlines Vite output into edge function source. Writes to **3 locations**: `functions/[[default]].js`, `functions/api/[[default]].js`, `edge-functions/[[default]].js`. Don't edit these files directly — they're regenerated on build.

Edge Functions cannot use npm packages or Node.js built-ins (fs/path/crypto).

## Key Files

| File | Role |
|------|------|
| `build-edge.cjs` | Build script — bundles dist/ into edge function |
| `edge-functions/[[default]].js` | Generated edge function (don't edit) |
| `src/App.tsx` | Frontend main app |
| `src/api.ts` | API call wrappers |
| `src/components/WriteCard.tsx` | Write/upload component |
| `src/components/ReadCard.tsx` | Read component |
| `src/components/FolderUpload.tsx` | Folder upload (webkitdirectory) |
| `src/components/QrCard.tsx` | QR code display/download |
| `src/components/ApiDocs.tsx` | API docs panel |
| `src/components/StatsCard.tsx` | Stats dashboard (total keys, size, writes today) |
| `src/components/MdRenderer.tsx` | Markdown render route /md/{key} |
| `src/lib/folderUtils.ts` | Folder upload utils (pathToKey, rewriteRefs, isBinary) |

## API

| Method | Path | Notes |
|--------|------|-------|
| `POST` | `/update/` | Write/update/delete (JSON `{key, value}` or FormData) |
| `POST` | `/{key}` | Direct write (body = content) |
| `GET` | `/{key}` | Raw read (`text/plain`) |
| `GET` | `/p/{key}` | HTML render (CSP headers) |
| `GET` | `/file/{ext}/{key}` | File by extension (auto Content-Type, html/svg rejected, nosniff) |
| `GET` | `/md/{key}` | Markdown render (SPA, frontend parses) |
| `GET` | `/stats` | Stats (totalKeys, totalSize, writesToday) via `TEXTDB.list()` |
| `DELETE` | `/{key}` | Delete |
| `OPTIONS` | Any | CORS preflight |

KV key regex: `^[0-9a-zA-Z_]{1,512}$`. KV single-value limit: 5 MiB.

## Code Style

- **Prettier**: `semi: false`, `singleQuote: false`, `trailingComma: "es5"`, `printWidth: 80`
- **Tailwind CSS**: `@` alias → `./src`. Path alias configured in both `vite.config.ts` and `tsconfig`
- **TypeScript**: strict mode, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`
- **Buttons/Tabs**: shadow-based 3D press effect (浮起→inset shadow + translate). See existing components for pattern
- **shadcn/ui**: radix-nova style, lucide icons. Don't assume other component libs exist

## Project Conventions

- `AGENTS.md` is the source; `CLAUDE.md` is a symlink to it
- Push auto-deploys — list change manifest before pushing
- No test framework; verify via lint + typecheck before pushing
- `dist/` and `.edgeone/` are gitignored
- `functions/` is gitignored but included in repo for EdgeOne Pages detection — `npm run build` regenerates it

## Runtime Constraints

- KV namespace: global `TEXTDB` (not in `context.env`)
- KV API: `TEXTDB.get(key)`, `TEXTDB.put(key, value)`, `TEXTDB.delete(key)`, `TEXTDB.list({prefix?, limit?, cursor?})`
- KV list returns `{ complete, cursor, keys: [{key}] }`, max 256 per page
- KV prefix: `tdb_` applied via `kvKey()` helper. Internal counters use `__writes__YYYY-MM-DD`
- Request body limit: ~5 MB (Edge Function limit), code enforces 5 MiB
- CSP on `/p/`: `script-src 'unsafe-inline'` (intentional — user HTML needs inline JS; real XSS risk in public-write scenario)
- CSP on `/p/`: `connect-src 'none'` (all fetch/XHR blocked in rendered HTML)
