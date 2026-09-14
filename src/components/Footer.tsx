import type { ReactNode } from "react";
import { ExternalLink, Hash, HardDrive, PencilLine } from "lucide-react";
import { formatSize } from "@/lib/utils";
import { EdgeOneLogo, GitHubLogo } from "./logos";
// CNB 链接已注释（原因见下方品牌行）。如需启用，请一并恢复此导入：
// import { CnbLogo } from "./logos";

interface FooterProps {
  totalKeys?: number;
  totalSize?: number;
  writesToday?: number;
}

/** 与 ui/button 一致的 shadow 3D 按压效果 */
const LINK_CLASS =
  "inline-flex items-center gap-1.5 rounded-md border bg-card px-2.5 py-1 font-medium transition-colors " +
  "hover:bg-accent hover:text-accent-foreground hover:shadow-[inset_0_2px_3px_rgba(0,0,0,0.1)] hover:translate-y-px " +
  "active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.18)] active:translate-y-[2px]";

function FooterLink({
  href,
  title,
  children,
}: {
  href: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      title={title}
      className={LINK_CLASS}
      target="_blank"
      rel="noreferrer"
    >
      {children}
      <ExternalLink className="size-3" />
    </a>
  );
}

export function Footer({ totalKeys, totalSize, writesToday }: FooterProps) {
  return (
    <footer className="border-t px-5 py-2.5">
      {/* Stats row */}
      {totalKeys !== undefined && (
        <div className="mb-2 flex flex-wrap items-center gap-x-5 gap-y-1 border-b pb-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Hash className="size-3.5" />
            总 Key 数 <strong className="text-foreground tabular-nums">{totalKeys}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <HardDrive className="size-3.5" />
            总存储 <strong className="text-foreground tabular-nums">{totalSize != null ? formatSize(totalSize) : "—"}</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <PencilLine className="size-3.5" />
            今日写入 <strong className="text-foreground tabular-nums">{writesToday ?? "—"}</strong>
          </span>
        </div>
      )}

      {/* Brand row */}
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-xs">
        <span className="font-semibold tracking-tight">TextDB EdgeOne</span>
        <span className="text-muted-foreground/40">·</span>
        <FooterLink href="https://pages.edgeone.ai" title="EdgeOne Pages 官网">
          <EdgeOneLogo className="size-3.5 shrink-0" />
          EdgeOne Pages
        </FooterLink>
        <FooterLink
          href="https://github.com/sixiang-world/textdb-edgeone"
          title="GitHub 仓库（CNB 主仓库的公开镜像）"
        >
          <GitHubLogo className="size-3.5 shrink-0" />
          GitHub
        </FooterLink>
        {/*
          此处有意不提供 CNB 仓库链接，对外只暴露 GitHub 镜像。

          CNB 才是本项目的**主仓库**：代码先提交到 CNB，由 `.cnb.yml` 的
          `sync-to-github` 阶段在每次 push 后自动同步（强推分支与 tag）到
          GitHub 公开镜像仓库，因此公开入口始终是 GitHub。

          CNB 仓库保持**私有**是为了保护云构建日志中的隐私信息——
          `.cnb.yml` 的部署脚本会用到 EDGEONE_PAGES_API_TOKEN 等密钥，
          构建日志与流水线详情可能包含这类敏感内容，仅限成员可见。

          若将来 CNB 仓库转为公开，取消下面这段注释即可恢复链接
          （并记得同时恢复顶部的 CnbLogo 导入）：

          <FooterLink
            href="https://cnb.cool/shisheng820/textdb-edgeone"
            title="CNB 仓库（主仓库，私有）"
          >
            <CnbLogo className="size-3.5 shrink-0" />
            CNB
          </FooterLink>
        */}
      </div>
    </footer>
  );
}
