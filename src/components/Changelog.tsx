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
