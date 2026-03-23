# 📦 TextDB EdgeOne

基于腾讯云 [EdgeOne Pages](https://cloud.tencent.com/product/edgeone) + KV 存储的在线文本数据库。

一个 API 搞定文本数据的存储、读取和删除，适合临时数据共享、配置分发、轻量级 PasteBin 等场景。

## ✨ 特性

- ⚡ **全球加速** — EdgeOne 边缘节点，读取低延迟
- 💾 **KV 存储** — 基于 EdgeOne KV，数据持久化
- 🌍 **CORS 支持** — 前端可直接跨域调用
- 🔓 **无需鉴权** — 靠随机 Key 防碰撞，简单直接
- 🎨 **精美前端** — 内置操作面板、历史记录、API 文档
- 🆓 **免费额度** — EdgeOne Pages 免费套餐即可部署

## 🚀 部署

### 1. Fork 本仓库

点击右上角 Fork 到你的 GitHub。

### 2. 创建 EdgeOne Pages 项目

1. 登录 [腾讯云 EdgeOne 控制台](https://console.cloud.tencent.com/edgeone)
2. 进入 **Pages** → **创建项目**
3. 选择 GitHub 仓库 `textdb-edgeone`
4. 构建设置保持默认（输出目录 `.`）

### 3. 绑定 KV 存储

1. 进入项目 **设置** → **函数** → **KV 存储绑定**
2. 添加绑定：
   - **变量名：** `TEXTDB`
   - **命名空间：** 创建新的或选择已有
3. 重新部署生效

### 4. 完成 🎉

访问你的域名即可使用。

## 📡 API

**基础 URL：** `https://<你的域名>`

### 写入 / 更新

```
POST /update/
Content-Type: application/x-www-form-urlencoded

key=mykey&value=hello world
```

**参数：**
| 参数 | 必填 | 说明 |
|------|------|------|
| key | ✅ | 文本标识，6-60 位，仅 `0-9a-zA-Z-_` |
| value | — | 文本数据，最大 20 万字符。留空则删除 |

### 读取

```
GET /{key}
```

返回 `text/plain` 格式的文本数据。Key 不存在时返回空字符串。

### 简写方式写入

```
POST /{key}
Content-Type: application/json

{"msg": "hello"}
```

### 删除

```
DELETE /{key}
```

或通过 `/update/` 接口设置 `value` 为空字符串。

### 响应格式

**写入成功：**
```json
{
  "status": 1,
  "data": {
    "key": "mykey",
    "url": "https://your-domain.com/mykey"
  },
  "req_id": "a1b2c3d4e5f6"
}
```

**删除成功：**
```json
{
  "status": 1,
  "data": {
    "key": "mykey",
    "url": "https://your-domain.com/mykey",
    "action": "deleted"
  },
  "req_id": "a1b2c3d4e5f6"
}
```

**失败：**
```json
{
  "status": 0,
  "error": "key 格式错误：6-60 位，仅支持 0-9a-zA-Z-_-"
}
```

## 💡 使用示例

### CURL

```bash
# 写入
curl -X POST "https://your-domain.com/update/" \
  -d "key=mykey&value=hello world"

# 读取
curl "https://your-domain.com/mykey"

# 删除
curl -X DELETE "https://your-domain.com/mykey"
```

### Python

```python
import requests

BASE = "https://your-domain.com"

# 写入
requests.post(f"{BASE}/update/", data={"key": "mykey", "value": "hello"})

# 读取
print(requests.get(f"{BASE}/mykey").text)

# 删除
requests.delete(f"{BASE}/mykey")
```

### JavaScript

```javascript
const BASE = "https://your-domain.com";

// 写入
await fetch(`${BASE}/update/`, {
  method: "POST",
  headers: {"Content-Type": "application/x-www-form-urlencoded"},
  body: "key=mykey&value=hello"
});

// 读取
const text = await (await fetch(`${BASE}/mykey`)).text();

// 删除
await fetch(`${BASE}/mykey`, {method: "DELETE"});
```

## ⚠️ 注意事项

- 读取不限次数，每个 IP 每日写入/删除操作限 **500 次**
- 数据**无密码保护**，建议使用 20 位以上随机 Key
- **1 年**未更新的记录会自动删除
- 严禁存储非法数据

## 📁 项目结构

```
textdb-edgeone/
├── edgeone.json          # EdgeOne Pages 配置
├── functions/
│   └── [[path]].js       # Edge Function（处理所有路由）
├── index.html            # 前端页面
└── README.md
```

## 📄 License

MIT-0 — 自由使用、修改、再发布，无需署名。
