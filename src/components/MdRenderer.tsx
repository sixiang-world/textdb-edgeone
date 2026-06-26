import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { readData } from "@/api";
import { Button } from "@/components/ui/button";
import { Copy, ArrowLeft, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const BASE = location.origin;

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
    return () => { aborted = true; };
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
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header bar */}
      <header className="flex items-center justify-between mb-6 pb-4 border-b">
        <a href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition">
          <ArrowLeft className="size-4" />
          返回首页
        </a>
        <a
          href={`${BASE}/${key}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ExternalLink className="size-4" />
          /{key}
        </a>
      </header>

      {/* Markdown content */}
      <article className="prose dark:prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          disallowedElements={["script", "style", "iframe", "object", "embed", "form"]}
        >
          {markdown}
        </ReactMarkdown>
      </article>

      {/* Footer */}
      <div className="mt-8 pt-4 border-t flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          md/{key}
        </span>
        <Button variant="ghost" size="sm" onClick={copyUrl}>
          <Copy className="size-4" />
          复制链接
        </Button>
      </div>
    </div>
  );
}
