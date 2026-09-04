import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";

interface ChangeItem {
  type: "新增" | "优化" | "修复";
  text: string;
}

interface VersionEntry {
  version: string;
  date: string;
  changes: ChangeItem[];
}

/**
 * 版本日志
 * 新版本发布时在数组开头追加 VersionEntry 即可。
 */
const VERSIONS: VersionEntry[] = [
  {
    version: "1.3.0",
    date: "2026-09-04",
    changes: [
      { type: "新增", text: "OpenAPI 文档页面（/api），基于 swagger-ui 展示完整 API 规范，支持在线调试" },
      { type: "新增", text: "本地 Key 历史浏览：操作页底部可折叠列表，记录最近 200 条写入过的 Key，支持搜索和一键选择" },
      { type: "新增", text: "写入队列 / 自动重试：所有写入、删除、上传通过 IndexedDB 队列串行执行，失败指数退避重试 3 次，网络恢复自动继续" },
      { type: "新增", text: "队列状态指示器：右下角浮动面板，展示 pending/processing/error 项，支持手动重试和丢弃" },
      { type: "新增", text: "Markdown 增强：KaTeX 数学公式、atom-one-dark 代码高亮、标题锚点、Mermaid 图表、右侧 TOC 目录导航" },
      { type: "修复", text: "文件夹上传进度条一闪即逝且按钮可重复点击的问题" },
      { type: "修复", text: "写入/删除按钮改为队列后未禁用导致重复入队的问题" },
      { type: "修复", text: "写入成功后密码字段未清除的肩窥风险" },
      { type: "修复", text: "队列操作失败时本地 UI 无反馈的问题" },
      { type: "修复", text: "writeQueue IndexedDB 写入未 await 导致静默丢失的问题" },
      { type: "修复", text: "Mermaid 未设置 securityLevel 的 XSS 风险" },
      { type: "优化", text: "重试次数上限导出为 MAX_RETRIES 常量，消除硬编码" },
      { type: "优化", text: "历史刷新事件名导出为 HISTORY_REFRESH_EVENT 常量" },
      { type: "优化", text: "ApiDocs fetch 添加 AbortController，组件卸载后不 setState" },
    ],
  },
  {
    version: "1.2.0",
    date: "2026-07-13",
    changes: [
      { type: "优化", text: "前端全面重构：从 Tab 标签页迁移为紧凑图标侧边栏布局，悬停展开文字提示" },
      { type: "优化", text: "页面布局新增侧边栏 + 工具栏面包屑 + 内容区 + 页脚统计的四层结构" },
      { type: "优化", text: "密码输入移至上传按钮右侧，支持展开/折叠输入新密码和移除密码" },
      { type: "优化", text: "统计信息从内容区移至页脚，页面更清爽" },
      { type: "新增", text: "导航状态持久化 (localStorage)，刷新或重开页面自动恢复上次所在的页面" },
      { type: "优化", text: "全局样式改用 Geist Variable 字体（Vercel 官方字体），shadcn/ui 原生色系" },
      { type: "修复", text: "修复 removePassword 状态优先级导致的静默密码移除问题" },
    ],
  },
  {
    version: "1.1.2",
    date: "2026-06-26",
    changes: [
      { type: "优化", text: "版本日志布局 — 最新版完全展开，旧版本默认折叠前 3 条" },
      { type: "修复", text: "修复全部历史 lint 错误（15 处）：any→unknown、@ts-ignore→@ts-expect-error、set-state-in-effect、未使用参数等" },
    ],
  },
  {
    version: "1.1.1",
    date: "2026-06-26",
    changes: [
      { type: "新增", text: "写入/读取合并为同一卡片，共享 Key 输入框" },
      { type: "新增", text: "读取后自动锁定只读模式，解锁后可编辑再保存" },
      { type: "新增", text: "写入/删除/上传后自动刷新统计面板" },
      { type: "修复", text: "分离写入/读取/删除的加载状态，避免误触全部转圈" },
    ],
  },
  {
    version: "1.1.0",
    date: "2026-06-26",
    changes: [
      { type: "新增", text: "统计面板：总 Key 数、总存储量、今日写入次数" },
      { type: "新增", text: "用计数器替代全量扫描计算总存储量，大幅提升性能" },
      { type: "优化", text: "KV 命名空间增加 tdb_ 前缀隔离，避免与内部计数器冲突" },
      { type: "新增", text: "文件夹上传（webkitdirectory），自动重写 HTML 引用路径" },
      { type: "新增", text: "Markdown 渲染路由 /md/{key}，前端解析 GFM" },
      { type: "新增", text: "按文件类型输出路由 /file/{ext}/{key}，支持附件下载" },
      { type: "优化", text: "长文本折叠预览（首尾 5 行），大幅提升大内容编辑体验" },
      { type: "新增", text: "QR 码生成与下载，写入/读取后均可展示" },
      { type: "修复", text: "EdgeOne KV 适配：修复 onRequest 入口及 KV 绑定机制" },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-06-26",
    changes: [
      { type: "新增", text: "文本写入 / 更新 / 删除，支持 JSON 与表单两种格式" },
      { type: "新增", text: "文本读取，Key 输入即可拉取数据并展示二维码" },
      { type: "新增", text: "文本文件上传，自动解析内容并折叠预览（首尾 5 行）" },
      { type: "新增", text: "文件夹上传（webkitdirectory），自动重写 HTML 引用，整站托管" },
      { type: "新增", text: "HTML 渲染路由 /p/{key}，带 CSP 安全头（禁外连）" },
      { type: "新增", text: "Markdown 渲染路由 /md/{key}，SPA 前端解析 GFM" },
      { type: "新增", text: "按文件类型输出路由 /file/{ext}/{key}，自动 Content-Type" },
      { type: "新增", text: "二维码生成与下载，写入 / 读取后均可展示" },
      { type: "新增", text: "内置 API 文档面板，含 cURL / Python / JavaScript 示例" },
      { type: "新增", text: "CORS 跨域全程支持，匿名读写无用户系统" },
      { type: "新增", text: "速率限制：读取不限次，写入 / 删除每 IP 每日 500 次" },
      { type: "新增", text: "1 年未更新的记录自动清理" },
    ],
  },
];

const MAX_VISIBLE = 3; // 旧版本默认显示前 3 条

const TYPE_VARIANT: Record<ChangeItem["type"], "default" | "secondary" | "destructive"> = {
  新增: "default",
  优化: "secondary",
  修复: "destructive",
};

export function Changelog() {
  // 默认展开最新版本（索引 0），其余折叠
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const init: Record<string, boolean> = {};
    VERSIONS.forEach((v, i) => {
      init[v.version] = i === 0;
    });
    return init;
  });

  return (
    <div className="flex flex-col gap-6">
      {VERSIONS.map((v, vi) => {
        const isExpanded = expanded[v.version] ?? vi === 0;
        const isLatest = vi === 0;
        const hasMore = v.changes.length > MAX_VISIBLE;
        const visible = isExpanded || isLatest
          ? v.changes
          : v.changes.slice(0, MAX_VISIBLE);

        return (
          <Card key={v.version}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <CardTitle>v{v.version}</CardTitle>
                <span className="text-sm text-muted-foreground">{v.date}</span>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="flex flex-col gap-3">
                {visible.map((c, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm">
                    <Badge variant={TYPE_VARIANT[c.type]} className="mt-0.5 shrink-0">
                      {c.type}
                    </Badge>
                    <span className="text-muted-foreground leading-relaxed">
                      {c.text}
                    </span>
                  </li>
                ))}
              </ul>
              {hasMore && !isLatest && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-3"
                  onClick={() =>
                    setExpanded((prev) => ({
                      ...prev,
                      [v.version]: !isExpanded,
                    }))
                  }
                >
                  {isExpanded ? (
                    <><ChevronUp /> 收起</>
                  ) : (
                    <><ChevronDown /> 展开全部（共 {v.changes.length} 条）</>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
