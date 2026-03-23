# TextDB EdgeOne

基于 EdgeOne Pages + KV 的在线文本数据库。

## 架构

- **前端**: shadcn/ui (React + Vite + Tailwind CSS)
- **后端**: EdgeOne Edge Functions + KV 存储
- **部署**: 构建时将编译产物内嵌到 edge function

## 开发

```bash
npm install
npm run dev          # 本地开发
npm run build        # 构建（Vite → 内嵌到 edge function）
```

## 部署流程

1. `npm run build` — Vite 编译前端 + 生成 `edge-functions/[[default]].js`
2. Git push — EdgeOne Pages 自动部署
3. 前端和 API 由同一个 edge function 提供服务

## API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /update/ | 写入 / 更新 / 删除 |
| GET | /{key} | 读取 |
| POST | /{key} | 直接写入 |
| DELETE | /{key} | 删除 |

## License

MIT
