import TurndownService from "turndown";

/** Editor HTML → Markdown (for export). */
export function htmlToMarkdown(html: string) {
  const td = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced", bulletListMarker: "-" });
  td.addRule("taskItem", {
    filter: (node) => node.nodeName === "LI" && (node as HTMLElement).getAttribute("data-type") === "taskItem",
    replacement: (content, node) => {
      const checked = (node as HTMLElement).getAttribute("data-checked") === "true";
      return `- [${checked ? "x" : " "}] ${content.trim().replace(/\n+/g, " ")}\n`;
    },
  });
  td.addRule("highlight", { filter: ["mark"], replacement: (c) => `==${c}==` });
  td.addRule("strike", { filter: ["s", "del"], replacement: (c) => `~~${c}~~` });
  return td.turndown(html);
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function inline(s: string) {
  return esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<s>$1</s>")
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');
}

/** Small Markdown → HTML converter for AI output (headings, lists, tasks, quotes, code). */
export function markdownToHtml(md: string) {
  const lines = md.replace(/\r/g, "").split("\n");
  const out: string[] = [];
  let list: "ul" | "ol" | "task" | null = null;
  let code: string[] | null = null;
  const closeList = () => {
    if (list) out.push(list === "ol" ? "</ol>" : "</ul>");
    list = null;
  };
  for (const line of lines) {
    if (code) {
      if (line.startsWith("```")) {
        out.push(`<pre><code>${esc(code.join("\n"))}</code></pre>`);
        code = null;
      } else code.push(line);
      continue;
    }
    if (line.startsWith("```")) {
      closeList();
      code = [];
      continue;
    }
    let m: RegExpExecArray | null;
    if ((m = /^(#{1,3})\s+(.*)$/.exec(line))) {
      closeList();
      out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
    } else if ((m = /^\s*[-*]\s+\[( |x)\]\s+(.*)$/i.exec(line))) {
      if (list !== "task") {
        closeList();
        out.push('<ul data-type="taskList">');
        list = "task";
      }
      out.push(`<li data-type="taskItem" data-checked="${m[1].toLowerCase() === "x"}"><p>${inline(m[2])}</p></li>`);
    } else if ((m = /^\s*[-*]\s+(.*)$/.exec(line))) {
      if (list !== "ul") {
        closeList();
        out.push("<ul>");
        list = "ul";
      }
      out.push(`<li><p>${inline(m[1])}</p></li>`);
    } else if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) {
      if (list !== "ol") {
        closeList();
        out.push("<ol>");
        list = "ol";
      }
      out.push(`<li><p>${inline(m[1])}</p></li>`);
    } else if ((m = /^>\s?(.*)$/.exec(line))) {
      closeList();
      out.push(`<blockquote><p>${inline(m[1])}</p></blockquote>`);
    } else if (!line.trim()) {
      closeList();
    } else {
      closeList();
      out.push(`<p>${inline(line)}</p>`);
    }
  }
  if (code) out.push(`<pre><code>${esc((code as string[]).join("\n"))}</code></pre>`);
  closeList();
  return out.join("");
}
