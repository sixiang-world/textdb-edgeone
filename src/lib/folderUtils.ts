const BASE = typeof location !== "undefined" ? location.origin : "";

/**
 * 文件名 → KV Key 映射
 * 规则：前缀 + 相对路径，/ 和 . 替换为 _
 *
 *   index.html       → mysite_index_html
 *   css/style.css    → mysite_css_style_css
 *   js/utils/date.js → mysite_js_utils_date_js
 */
export function pathToKey(prefix: string, relativePath: string): string {
  // Normalize: remove leading ./ or ../
  let p = relativePath.replace(/^\.{1,2}\//, "");
  // Replace separators: / and . → _
  p = p.replace(/[\/.]/g, "_");
  return `${prefix}_${p}`;
}

/**
 * HTML 引用改写：将 <link href> 和 <script src> 的相对路径
 * 替换为上传后的远程 URL
 *
 * @param html        HTML 内容
 * @param prefix      项目前缀
 * @param fileMap     相对路径 → KV key 映射
 * @param htmlRelPath HTML 文件自身的相对路径（用于解析相对路径）
 */
export function rewriteRefs(
  html: string,
  prefix: string,
  fileMap: Map<string, string>,
  htmlRelPath?: string,
): string {
  // Determine the base directory of the HTML file (for resolving relative paths)
  const baseDir = htmlRelPath
    ? htmlRelPath.replace(/\/[^/]*$/, "")  // strip filename → directory
    : "";

  function resolveRef(url: string): string | null {
    if (isAbsoluteUrl(url)) return null;

    // Try the URL as-is first (file in root of folder)
    let resolved = resolveRelative(url, fileMap, prefix);
    if (resolved) return resolved;

    // If HTML has a base dir, try prepending it (e.g. "css/style.css" → "00000/css/style.css")
    if (baseDir) {
      const prefixed = baseDir + "/" + url.replace(/^\.{1,2}\//, "");
      resolved = resolveRelative(prefixed, fileMap, prefix);
      if (resolved) return resolved;
    }

    return null;
  }

  let result = html;

  // Rewrite <link href="...">
  result = result.replace(
    /<link\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi,
    (match, url: string) => {
      const resolved = resolveRef(url);
      if (!resolved) return match;
      return match.replace(url, `${BASE}/${resolved}`);
    }
  );

  // Rewrite <script src="...">
  result = result.replace(
    /<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi,
    (match, url: string) => {
      const resolved = resolveRef(url);
      if (!resolved) return match;
      return match.replace(url, `${BASE}/${resolved}`);
    }
  );

  return result;
}

/** Check if a URL is absolute (starts with http://, https://, //, data:) */
function isAbsoluteUrl(url: string): boolean {
  return /^(https?:)?\/\/|^data:/i.test(url);
}

/** Resolve a relative path against the fileMap */
function resolveRelative(
  url: string,
  fileMap: Map<string, string>,
  _prefix: string
): string | null {
  const normalized = url.replace(/^\.{1,2}\//, "");
  const key = fileMap.get(normalized);
  if (key) return key;
  // Not in map — file wasn't uploaded (binary, etc.), leave reference unchanged
  return null;
}

/**
 * 构建相对路径 → KV Key 的映射表
 */
export function buildFileMap(
  prefix: string,
  files: Array<{ relativePath: string }>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const f of files) {
    const normalized = f.relativePath.replace(/^\.{1,2}\//, "");
    map.set(normalized, pathToKey(prefix, f.relativePath));
  }
  return map;
}

/**
 * 启发式二进制检测：检查前 1000 字符中 null 字节或非打印字符比例
 */
export function isBinary(content: string): boolean {
  const sample = content.slice(0, 1000);
  if (sample.length === 0) return false;
  let weird = 0;
  for (let i = 0; i < sample.length; i++) {
    const ch = sample.charCodeAt(i);
    if (ch === 0 || (ch < 9 && ch !== 10 && ch !== 13)) {
      weird++;
    }
  }
  return weird / sample.length > 0.1;
}

export interface UploadItem {
  relativePath: string;
  name: string;
  content: string;
  key: string;
}

export interface UploadResult {
  key: string;
  name: string;
  success: boolean;
  error?: string;
}
