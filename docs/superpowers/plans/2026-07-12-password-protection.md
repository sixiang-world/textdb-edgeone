# Password Protection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Key-level password protection: write with password, update/delete requires it, read stays public.

**Architecture:** Password hash (SHA-256 + random salt) stored in a companion KV key (`tdb_{key}.pwd`) isolated from external access by the `.pwd` suffix not matching the key regex. Backend logic lives in `build-edge.cjs` which generates the edge function. Frontend adds a persistent password field to WriteCard.

**Tech Stack:** EdgeOne V8 runtime (Web Crypto API), React 19, TypeScript

---

### Task 1: Backend — Password utilities and CORS update in build-edge.cjs

**Files:**
- Modify: `build-edge.cjs:28-52` (constants and utilities region)

- [ ] **Step 1: Add X-Password to CORS headers**

In `build-edge.cjs`, change:
```diff
- 'Access-Control-Allow-Headers': 'Content-Type'
+ 'Access-Control-Allow-Headers': 'Content-Type, X-Password'
```

- [ ] **Step 2: Add password utility functions**

After `getMimeType()` (around line 52), insert:

```js
// --- Password protection helpers ---
const _pwdEncoder = new TextEncoder();

function passwordKey(key) { return KV_PREFIX + key + '.pwd'; }

function generateSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes));
}

async function sha256Hex(saltB64, password) {
  const salt = Uint8Array.from(atob(saltB64), c => c.charCodeAt(0));
  const combined = new Uint8Array(salt.length + _pwdEncoder.encode(password).length);
  combined.set(salt);
  combined.set(_pwdEncoder.encode(password), salt.length);
  const hash = await crypto.subtle.digest('SHA-256', combined);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function getPasswordMeta(key) {
  const raw = await TEXTDB.get(passwordKey(key));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

async function checkPassword(key, password) {
  if (!password) return false;
  const meta = await getPasswordMeta(key);
  if (!meta) return false;
  const hash = await sha256Hex(meta.s, password);
  return hash === meta.h;
}

async function setPasswordMeta(key, password) {
  if (password.length < 4 || password.length > 128) throw new Error('Password must be 4-128 characters');
  const salt = generateSalt();
  const hash = await sha256Hex(salt, password);
  await TEXTDB.put(passwordKey(key), JSON.stringify({h: hash, s: salt, v: 1}));
}

async function removePasswordMeta(key) {
  await TEXTDB.delete(passwordKey(key));
}
```

- [ ] **Step 3: Verify build still works**

Run: `node build-edge.cjs`
Expected: exits with "✅ build-edge.cjs fixed with safe join."

- [ ] **Step 4: Commit**

```bash
git add build-edge.cjs
git commit -m "feat: add password hash utilities and X-Password CORS header"
```

---

### Task 2: Backend — Password enforcement in POST/DELETE handlers

**Files:**
- Modify: `build-edge.cjs` — `handleApi` function (inside the `lines` array, currently lines 54-122)

- [ ] **Step 1: Add X-Password header read for direct POST `/{key}` path**

Find the `else` branch at the direct-write path (around line 75-77):

```js
} else {
  key = path.split('/').pop();
  value = ct.includes('json') ? await request.json().then(v => typeof v === 'string' ? v : JSON.stringify(v)) : await request.text();
  params.password = request.headers.get('X-Password') || '';  // ← add this line
}
```

- [ ] **Step 2: Rewrite POST handler with password enforcement**

Replace the section starting from key validation (`if (!key || !/^[0-9a-zA-Z_]`) through the stats update return — currently lines 79-101 — with:

```js
if (!key || !/^[0-9a-zA-Z_]{1,512}$/.test(key)) return new Response(JSON.stringify({status:0, error:'Invalid Key'}), {status:400, headers: {...CORS, 'Content-Type':'application/json'}});

// --- Delete path (empty value) ---
if (!value) {
  const pwdMeta = await getPasswordMeta(key);
  if (pwdMeta) {
    const pwd = request.headers.get('X-Password') || params.password || '';
    if (!pwd) return new Response(JSON.stringify({status:0, error:'Password required'}), {status:400, headers: {...CORS, 'Content-Type':'application/json'}});
    if (!(await checkPassword(key, pwd))) return new Response(JSON.stringify({status:0, error:'Incorrect password'}), {status:400, headers: {...CORS, 'Content-Type':'application/json'}});
    await removePasswordMeta(key);
  }
  const oldVal = await TEXTDB.get(kvKey(key));
  await TEXTDB.delete(kvKey(key));
  try { if (oldVal) { const s = '__stats_size__'; await TEXTDB.put(s, String(Math.max(0, Number(await TEXTDB.get(s) || '0') - byteLen(oldVal)))); } } catch (_) {}
  return new Response(JSON.stringify({status:1, data:{key, action:'deleted'}}), {headers: {...CORS, 'Content-Type':'application/json'}});
}

// --- Write/Update path ---
const MAX_VALUE_SIZE = 5 * 1024 * 1024;
const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
if (byteLen(valueStr) > MAX_VALUE_SIZE) {
  return new Response(JSON.stringify({status:0, error:'Value too large (max 5 MiB)'}), {status:413, headers: {...CORS, 'Content-Type':'application/json'}});
}

const inputPwd = params.password || request.headers.get('X-Password') || '';
const newPwd = params.new_password;
const existingMeta = await getPasswordMeta(key);

if (existingMeta) {
  // Key has password — verify before allowing update
  if (!inputPwd) return new Response(JSON.stringify({status:0, error:'Password required'}), {status:400, headers: {...CORS, 'Content-Type':'application/json'}});
  if (!(await checkPassword(key, inputPwd))) return new Response(JSON.stringify({status:0, error:'Incorrect password'}), {status:400, headers: {...CORS, 'Content-Type':'application/json'}});
  // Password correct — handle password change/removal
  if (newPwd !== undefined && newPwd !== null) {
    if (newPwd === '') {
      await removePasswordMeta(key);
    } else {
      await setPasswordMeta(key, newPwd);
    }
  }
} else {
  // Key has no password — first-time setup if password provided
  if (inputPwd) {
    if (inputPwd.length < 4 || inputPwd.length > 128) {
      return new Response(JSON.stringify({status:0, error:'Password must be 4-128 characters'}), {status:400, headers: {...CORS, 'Content-Type':'application/json'}});
    }
    await setPasswordMeta(key, inputPwd);
  }
}

const oldVal = await TEXTDB.get(kvKey(key));
await TEXTDB.put(kvKey(key), value);
try {
  const today = new Date().toISOString().slice(0, 10);
  const wKey = '__writes__' + today;
  await TEXTDB.put(wKey, String(Number(await TEXTDB.get(wKey) || '0') + 1));
  const newBytes = byteLen(valueStr), oldBytes = oldVal ? byteLen(oldVal) : 0;
  if (newBytes !== oldBytes) { const s = '__stats_size__'; await TEXTDB.put(s, String(Math.max(0, Number(await TEXTDB.get(s) || '0') + newBytes - oldBytes))); }
} catch (_) {}
return new Response(JSON.stringify({status:1, data:{key, url: url.origin + '/' + key}}), {headers: {...CORS, 'Content-Type':'application/json'}});
```

- [ ] **Step 3: Rewrite DELETE handler with password enforcement**

Replace the existing DELETE block (currently lines 110-117) with:

```js
if (request.method === 'DELETE') {
  const key = path.split('/').pop();
  if (!key || !/^[0-9a-zA-Z_]{1,512}$/.test(key)) return new Response(JSON.stringify({status:0, error:'Invalid Key'}), {status:400, headers: {...CORS, 'Content-Type':'application/json'}});
  const pwdMeta = await getPasswordMeta(key);
  if (pwdMeta) {
    const pwd = request.headers.get('X-Password') || '';
    if (!pwd) return new Response(JSON.stringify({status:0, error:'Password required'}), {status:400, headers: {...CORS, 'Content-Type':'application/json'}});
    if (!(await checkPassword(key, pwd))) return new Response(JSON.stringify({status:0, error:'Incorrect password'}), {status:400, headers: {...CORS, 'Content-Type':'application/json'}});
    await removePasswordMeta(key);
  }
  const oldVal = await TEXTDB.get(kvKey(key));
  await TEXTDB.delete(kvKey(key));
  try { if (oldVal) { const s = '__stats_size__'; await TEXTDB.put(s, String(Math.max(0, Number(await TEXTDB.get(s) || '0') - byteLen(oldVal)))); } } catch (_) {}
  return new Response(JSON.stringify({status:1, data:{key, action:'deleted'}}), {headers: {...CORS, 'Content-Type':'application/json'}});
}
```

- [ ] **Step 4: Verify build**

Run: `node build-edge.cjs`
Expected: "✅ build-edge.cjs fixed with safe join."

Verify: `grep -c "passwordKey\|getPasswordMeta\|checkPassword\|setPasswordMeta" functions/[[default]].js`
Expected: at least 4 matches.

- [ ] **Step 5: Commit**

```bash
git add build-edge.cjs
git commit -m "feat: enforce password on update/delete; support set/change/remove password"
```

---

### Task 3: Frontend — API layer update (src/api.ts)

**Files:**
- Modify: `src/api.ts:19-35` (writeData, deleteData)

- [ ] **Step 1: Update writeData to accept password params**

Replace the existing function:

```typescript
export async function writeData(key: string, value: string, password?: string, newPassword?: string) {
  const body = new URLSearchParams();
  body.set('key', key);
  body.set('value', value);
  if (password) body.set('password', password);
  if (newPassword !== undefined) body.set('new_password', newPassword);
  const res = await fetch(`${BASE}/update/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  return res.json();
}
```

- [ ] **Step 2: Update deleteData to accept password param**

Replace the existing function:

```typescript
export async function deleteData(key: string, password?: string) {
  const body = new URLSearchParams();
  body.set('key', key);
  body.set('value', '');
  if (password) body.set('password', password);
  const res = await fetch(`${BASE}/update/`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  return res.json();
}
```

- [ ] **Step 3: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: success.

- [ ] **Step 4: Commit**

```bash
git add src/api.ts
git commit -m "feat: add password params to writeData and deleteData"
```

---

### Task 4: Frontend — Password UI in WriteCard

**Files:**
- Modify: `src/components/WriteCard.tsx`

**UI Structure:**
- Add `Eye` and `EyeOff` to the lucide-react import
- Add state: `password`, `newPassword`, `showPassword`, `showPwdOptions`
- Password input: always visible, below the key input row, with show/hide toggle
- "Change password" section: only visible when password field is non-empty, activated by a toggle button/link
- The new password field only sends `new_password` when it has been explicitly opened AND filled in — never send `new_password=""` by accident (which would remove password protection)

- [ ] **Step 1: Add Eye and EyeOff icon imports**

Find the lucide-react import line and add:

```diff
-  ChevronDown, ChevronUp, Copy, ExternalLink, Loader2, Lock, Search, Shuffle, Trash2, Upload,
+  ChevronDown, ChevronUp, Copy, ExternalLink, Eye, EyeOff, Loader2, Lock, Search, Shuffle, Trash2, Upload,
```

- [ ] **Step 2: Add password state variables**

After `const [readOnly, setReadOnly] = useState(false);` (line 94), add:

```typescript
const [password, setPassword] = useState("");
const [newPassword, setNewPassword] = useState("");
const [showPassword, setShowPassword] = useState(false);
const [showPwdOptions, setShowPwdOptions] = useState(false);
```

- [ ] **Step 3: Add password input UI after the key input row**

Find the closing `</div>` of the key input + shuffle button group (around line 232), and insert after it:

```tsx
{/* Password input — always visible */}
<div className="flex flex-col gap-2">
  <div className="flex gap-2 items-center">
    <Input
      type={showPassword ? "text" : "password"}
      placeholder="Password (set on write, verify on update/delete)"
      value={password}
      onChange={(e) => setPassword(e.target.value)}
      className="font-mono"
    />
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setShowPassword(!showPassword)}
      tabIndex={-1}
      type="button"
    >
      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
    </Button>
  </div>
  {password && (
    <div className="flex items-center gap-2">
      <Button
        variant="link"
        size="sm"
        onClick={() => setShowPwdOptions(!showPwdOptions)}
        className="h-auto p-0 text-xs text-muted-foreground"
        type="button"
      >
        {showPwdOptions ? "▼" : "▶"} Change / remove password
      </Button>
    </div>
  )}
  {showPwdOptions && (
    <div className="flex flex-col gap-2 pl-2 border-l-2 border-muted">
      <Input
        type="password"
        placeholder="New password (leave empty to remove protection)"
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        className="font-mono text-sm"
      />
    </div>
  )}
</div>
```

- [ ] **Step 4: Wire password into handleWrite**

Modify `handleWrite` — send `password` and `newPassword` only when explicitly set. The key rule: only send `new_password` if `showPwdOptions` is true, preventing accidental password removal:

Find the try block in handleWrite (around line 135) and update:

```typescript
try {
  const pwd = password || undefined;
  // Only send new_password if user explicitly opened the options section
  const npwd = showPwdOptions ? (newPassword !== undefined ? newPassword : undefined) : undefined;
  const d = await writeData(key, value, pwd, npwd);
  // ... rest unchanged
```

- [ ] **Step 5: Wire password into handleDelete**

Modify `handleDelete` — send password from the password field:

```typescript
try {
  const d = await deleteData(key, password || undefined);
  // ... rest unchanged
```

- [ ] **Step 6: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: success.

- [ ] **Step 7: Build the full project**

Run: `npm run build`
Expected: Vite build succeeds, then build-edge.cjs generates output files.

- [ ] **Step 8: Commit**

```bash
git add src/components/WriteCard.tsx
git commit -m "feat: add password UI to WriteCard"
```

---

### Task 5: Frontend — Update API Docs

**Files:**
- Modify: `src/components/ApiDocs.tsx`

- [ ] **Step 1: Add password params to the params table**

Add two new rows to the `params` array (around line 33-36):

```diff
 const params = [
   { name: "key", required: true, desc: "文本标识，仅支持字母、数字、下划线，最长 512 字符" },
   { name: "value", required: false, desc: "文本数据，最大 5 MiB。留空则删除" },
+  { name: "password", required: false, desc: "密码。首次写入时设置，后续更新/删除需传入验证" },
+  { name: "new_password", required: false, desc: "新密码。传入正确 password 后可改密码或置空移除保护" },
 ];
```

- [ ] **Step 2: Update curl example to show password usage**

Update the `curlCode` string (around line 38-46). Keep the existing examples and add password variants:

```typescript
const curlCode = `# 写入（无密码）
curl -X POST "${B}/update/" \\
  -d "key=mykey&value=hello world"

# 写入（带密码）
curl -X POST "${B}/update/" \\
  -d "key=mykey&value=hello world&password=abc123"

# 更新（需密码验证）
curl -X POST "${B}/update/" \\
  -d "key=mykey&value=new content&password=abc123"

# 读取（无需密码）
curl "${B}/mykey"

# 删除（无密码）
curl -X DELETE "${B}/mykey"

# 删除（有密码）
curl -X DELETE "${B}/mykey" \\
  -H "X-Password: abc123"`;
```

- [ ] **Step 3: Update Python example to show password usage**

```typescript
const pyCode = `import requests

# 写入（带密码）
requests.post("${B}/update/",
  data={"key": "mykey", "value": "hello world", "password": "abc123"})

# 读取
print(requests.get("${B}/mykey").text)

# 删除（有密码）
requests.post("${B}/update/",
  data={"key": "mykey", "value": "", "password": "abc123"})`;
```

- [ ] **Step 4: Update JavaScript example to show password usage**

```typescript
const jsCode = `// 写入（带密码）
await fetch("${B}/update/", {
  method: "POST",
  headers: {"Content-Type": "application/x-www-form-urlencoded"},
  body: "key=mykey&value=hello world&password=abc123"
});

// 读取
const text = await (await fetch("${B}/mykey")).text();

// 删除（有密码）
await fetch("${B}/update/", {
  method: "POST",
  headers: {"Content-Type": "application/x-www-form-urlencoded"},
  body: "key=mykey&value=&password=abc123"
});`;
```

- [ ] **Step 5: Update the security notes in the description card**

Find the description list item that says "数据无密码保护" (around line 176) and update:

```diff
- <li>数据无密码保护，建议使用随机 Key</li>
+ <li>写入时可设置密码保护，后续更新/删除需验证密码，读取始终不需要密码</li>
```

- [ ] **Step 6: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: success.

- [ ] **Step 7: Commit**

```bash
git add src/components/ApiDocs.tsx
git commit -m "docs: update API docs with password parameter descriptions and examples"
```

---

### Verification Guide (manual testing after deploy)

No automated integration test suite exists for this project, so verify manually via curl:

1. **Write without password**: `curl -X POST "${BASE}/update/" -d "key=test1&value=hello"` → `{"status":1,...}`
2. **Read**: `curl "${BASE}/test1"` → `"hello"`
3. **Write with password (first time)**: `curl -X POST "${BASE}/update/" -d "key=test2&value=secret&password=mypass"` → `{"status":1,...}`
4. **Read password-protected key**: `curl "${BASE}/test2"` → `"secret"` (no password needed)
5. **Update without password**: `curl -X POST "${BASE}/update/" -d "key=test2&value=new"` → `{"status":0,"error":"Password required"}`
6. **Update with wrong password**: `curl -X POST "${BASE}/update/" -d "key=test2&value=new&password=wrong"` → `{"status":0,"error":"Incorrect password"}`
7. **Update with correct password**: `curl -X POST "${BASE}/update/" -d "key=test2&value=new&password=mypass"` → `{"status":1,...}`
8. **Change password**: `curl -X POST "${BASE}/update/" -d "key=test2&value=new2&password=mypass&new_password=newpass"` → succeeds
9. **Verify old password invalid**: `curl -X POST "${BASE}/update/" -d "key=test2&value=x&password=mypass"` → `"Incorrect password"`
10. **New password works**: `curl -X POST "${BASE}/update/" -d "key=test2&value=x&password=newpass"` → succeeds
11. **Remove password**: `curl -X POST "${BASE}/update/" -d "key=test2&value=open&password=newpass&new_password="` → succeeds
12. **Verify password removed**: `curl -X POST "${BASE}/update/" -d "key=test2&value=anyone"` → succeeds
13. **Delete with password**: create `test3` with password, then: `curl -X DELETE "${BASE}/test3" -H "X-Password: mypass"` → succeeds
14. **DELETE without password**: `curl -X DELETE "${BASE}/test3"` → `{"status":0,"error":"Password required"}`
15. **Direct POST with X-Password**: `curl -X POST "${BASE}/test2" -H "Content-Type: text/plain" -d "bodydata" -H "X-Password: mypass"` → succeeds

---

## Design Decisions Summary

| Decision | Choice | Reason |
|----------|--------|--------|
| Hash algorithm | SHA-256 + 16B random salt | V8 runtime limitation, best available |
| Meta key format | `tdb_{key}.pwd` | `.` isolated by key regex, no extra guard needed |
| Meta storage | `{"h":"<hex>","s":"<b64>","v":1}` | Compact, versioned for future upgrades |
| Password min length | 4 chars | Prevent trivial empty/one-char passwords |
| Password max length | 128 chars | KV value size consideration, UX |
| CORS header | Added `X-Password` | Allow browser fetch to send password header |
| First-time password set | Any write with password field | Consistent with "anonymous" design philosophy |
