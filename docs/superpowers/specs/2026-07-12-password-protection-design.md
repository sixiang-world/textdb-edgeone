# Password Protection for TextDB EdgeOne

> 为 TextDB EdgeOne 增加 Key 级别的密码保护功能：写入时可设密码，更新/删除需验证密码，读取不受影响。

## Background

TextDB EdgeOne 是一个匿名 Key-Value 文本数据库，无用户系统，所有数据公开可读写。随着使用场景扩展，用户需要保护已写入的内容不被他人覆盖或删除，同时保持数据本身的公开可读性。

## Constraints

- 无用户系统，不引入身份认证
- 读取路径零影响：`GET /{key}`、`GET /p/{key}`、`GET /file/{ext}/{key}`、`GET /md/{key}` 均不检查密码
- KV 单值上限 5 MiB，需控制元数据大小
- EdgeOne V8 运行时限制：无 Node.js 内置模块，需用 Web API（`crypto.subtle`）做哈希

## Storage

### KV Key 命名

| KV Key | 用途 | 格式 |
|--------|------|------|
| `tdb_{key}` | 文本内容 | 纯文本（不变） |
| `tdb_{key}.pwd` | 密码元数据 | `{"h":"<hex>","s":"<b64>","v":1}` |

密码元数据使用 `.` 做命名空间隔离。外部 key 校验正则 `/^[0-9a-zA-Z_]{1,512}$/` 不允许 `.` 出现，因此所有外部请求（GET/POST/DELETE）均无法触及 `tdb_{key}.pwd` 记录。

### 哈希算法

- 算法：SHA-256
- 盐：16 字节随机盐，Base64 编码存储
- 哈希值：SHA-256(盐 + 密码)，Hex 编码存储
- 版本字段 `v` 预留未来算法升级

存储结构示例：
```json
{"h":"a1b2c3...","s":"abc123...","v":1}
```

## API Changes

### Password Transmission

| Method | Path | Password 传参方式 |
|--------|------|-------------------|
| `POST` | `/update/` | JSON/Form 体中的 `password` / `new_password` 字段 |
| `POST` | `/{key}` | `X-Password` HTTP Header |
| `DELETE` | `/{key}` | `X-Password` HTTP Header |
| `GET` | 全系 | 不变 |

### Password State Machine

#### Write / Update (`POST /update/`)

| Key 状态 | `password` | `new_password` | 行为 |
|----------|-----------|---------------|------|
| 无密码 | 不传 | — | 同现在，正常写入 |
| 无密码 | `"abc"` | — | 写入内容 + 设密码为 abc |
| 有密码 | ✅ 正确 | 不传 | 更新内容，密码不变 |
| 有密码 | ✅ 正确 | `"新密码"` | 更新内容 + 换密码 |
| 有密码 | ✅ 正确 | `""` | 更新内容 + **删除**密码保护 |
| 有密码 | ❌ 错误 | — | `{"status":0,"error":"Incorrect password"}` (400) |
| 有密码 | 不传 | — | `{"status":0,"error":"Password required"}` (400) |

#### Direct Write (`POST /{key}`)

同 `/update/` 逻辑，`password` 通过 `X-Password` Header 传入。

#### Delete (`DELETE /{key}`)

| Key 状态 | `X-Password` | 行为 |
|----------|-------------|------|
| 无密码 | 不传 | 同现在，正常删除 |
| 有密码 | ✅ 正确 | 删除内容 + 删除密码元数据 |
| 有密码 | ❌ 错误/不传 | 400 报错 |

#### Read (所有 GET 路由)

**完全不变**，任何 key 均可无密码读取。

## Frontend Changes

### WriteCard (`src/components/WriteCard.tsx`)

- 新增密码输入框，常驻显示在 Key 输入框下方
- 写入时：密码框有值 → 设密码；无值 → 不设密码
- 更新时：密码框用于验证身份
- 读取时：忽略密码框内容
- 删除时：密码框用于验证身份
- 密码框类型为 `password`（输入掩码），可加一个显/隐切换图标

### api.ts

- `writeData(key, value, password?, newPassword?)` — 新增参数
- `deleteData(key, password?)` — 新增参数
- `readData` — 不变

### ApiDocs

- API 文档页同步更新密码相关参数说明

## Error Responses

```json
{"status":0,"error":"Password required"}
{"status":0,"error":"Incorrect password"}
```

服务端不暴露某个 key 是否有密码保护（不返回类似 `needPassword` 的标记）。前端在每次更新/删除操作时提交密码框内容，通过错误信息判断。

## Security Considerations

1. **密码强度**：密码长度至少 4 字符，最大 128 字符
2. **哈希算法**：SHA-256 + 随机盐防彩虹表。V8 运行时无 bcrypt/argon2 支持，此为最佳可用方案
3. **元数据隔离**：`tdb_{key}.pwd` 中的 `.` 被 key 校验正则阻挡，外部请求无法直接读取或篡改密码元数据
4. **无时序侧信道**：密码验证失败返回统一错误信息，不区分"无密码 key"和"密码错误"
5. **KV 原子性**：密码元数据与内容分别写入 KV，非事务性。写入内容成功但写入密码元数据失败 → 内容无保护；删除内容成功但删除密码元数据失败 → 遗留脏数据。两者均不影响系统整体可用性，脏数据由后续操作覆盖

## Implementation Plan

计划在以下文件中实现密码功能：

1. **`functions/api/[[default]].js`** — 核心：密码校验逻辑、哈希工具、API 路由变更
2. **`src/api.ts`** — 前端 API 层：`writeData` 和 `deleteData` 新增密码参数
3. **`src/components/WriteCard.tsx`** — 前端 UI：密码输入框、更新/删除时提交密码
4. **`docs/superpowers/specs/`** — 本设计文档
