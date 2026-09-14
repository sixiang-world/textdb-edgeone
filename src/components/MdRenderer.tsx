import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypeKatex from "rehype-katex";
import { readData } from "@/api";
import { Button } from "@/components/ui/button";
import { Copy, ArrowLeft, ExternalLink, List } from "lucide-react";
import { toast } from "sonner";
import "katex/dist/katex.min.css";
import "highlight.js/styles/atom-one-dark.css";

const BASE = location.origin;

// --- Mermaid 代码块（动态加载 mermaid） ---
function MermaidBlock({ chart }: { chart: string }) {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setSvg("");
    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        const isDark = document.documentElement.classList.contains("dark");
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? "dark" : "default",
          securityLevel: "strict",
        });
        const id = "mermaid-" + Math.random().toString(36).slice(2);
        const result = await mermaid.render(id, chart);
        if (!cancelled) {
          setSvg(result.svg);
          setLoading(false);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (loading) {
    return (
      <div className="rounded-lg border bg-muted/50 p-4 text-center text-sm text-muted-foreground">
        正在渲染 Mermaid 图表...
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm font-medium text-destructive">Mermaid 渲染失败</p>
        <pre className="mt-2 overflow-x-auto text-xs text-destructive/80">{error}</pre>
      </div>
    );
  }

  return (
    <div
      className="mermaid-block overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

// --- 自定义 code 组件（区分 mermaid 和普通代码） ---
function CodeBlock({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"code">) {
  const match = /language-(\w+)/.exec(className || "");
  const lang = match?.[1];
  const code = String(children).replace(/\n$/, "");

  if (lang === "mermaid") {
    return <MermaidBlock chart={code} />;
  }

  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
}

// --- TOC 目录（从渲染后 DOM 提取标题） ---
function TableOfContents() {
  const [headings, setHeadings] = useState<
    { id: string; text: string; level: number }[]
  >([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function extract() {
      const article = document.querySelector("article.md-content");
      if (!article) return;
      const els = article.querySelectorAll("h1, h2, h3, h4");
      const items = Array.from(els)
        .map((el) => ({
          id: el.id,
          text: el.textContent || "",
          level: parseInt(el.tagName[1]),
        }))
        .filter((h) => h.id && h.text);
      setHeadings(items);
    }

    extract();

    const article = document.querySelector("article.md-content");
    if (article) {
      const observer = new MutationObserver(extract);
      observer.observe(article, { childList: true, subtree: true });
      return () => observer.disconnect();
    }
  }, []);

  if (headings.length < 2) return null;

  return (
    <div className="toc-wrapper">
      <button
        className="toc-toggle"
        onClick={() => setOpen(!open)}
        aria-label="目录"
      >
        <List className="h-4 w-4" />
        <span className="hidden sm:inline">目录</span>
      </button>
      {open && (
        <nav className="toc-panel">
          <ul>
            {headings.map((h) => (
              <li
                key={h.id}
                style={{ paddingLeft: `${(h.level - 1) * 12}px` }}
              >
                <a href={`#${h.id}`} onClick={() => setOpen(false)}>
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </div>
  );
}

export function MdRenderer() {
  const key = location.pathname.slice(4); // remove "/md/"
  const [markdown, setMarkdown] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let aborted = false;
    (async () => {
      setLoading(true);
      try {
        const text = await readData(key);
        if (aborted) return;
        if (!text) {
          setError("Key 不存在或内容为空");
        } else {
          setMarkdown(text);
        }
      } catch (e: unknown) {
        if (aborted) return;
        setError("加载失败: " + (e instanceof Error ? e.message : String(e)));
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, [key]);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(location.href);
      toast.success("链接已复制");
    } catch {
      toast.error("复制失败");
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground mb-4">{error}</p>
        <a href="/" className="text-primary underline">返回首页</a>
      </div>
    );
  }

  return (
    <div className="md-page">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header bar */}
        <header className="flex items-center justify-between mb-6 pb-4 border-b">
          <a
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="size-4" />
            返回首页
          </a>
          <div className="flex items-center gap-4">
            <TableOfContents />
            <a
              href={`${BASE}/${key}`}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
            >
              <ExternalLink className="size-4" />
              /{key}
            </a>
          </div>
        </header>

        {/* Markdown content */}
        <article className="prose dark:prose-invert max-w-none md-content">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[
              rehypeHighlight,
              rehypeSlug,
              [rehypeAutolinkHeadings, { behavior: "wrap" }],
              rehypeKatex,
            ]}
            disallowedElements={["script", "style", "iframe", "object", "embed", "form"]}
            components={{
              code: CodeBlock,
            }}
          >
            {markdown}
          </ReactMarkdown>
        </article>

        {/* Footer */}
        <div className="mt-8 pt-4 border-t flex items-center justify-between">
          <span className="text-xs text-muted-foreground">md/{key}</span>
          <Button variant="ghost" size="sm" onClick={copyUrl}>
            <Copy className="size-4" />
            复制链接
          </Button>
        </div>
      </div>
    </div>
  );
}
