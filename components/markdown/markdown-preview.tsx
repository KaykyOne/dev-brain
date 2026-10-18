import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { splitFrontmatter } from "@/lib/markdown/split";
import { cn } from "@/lib/utils";

/**
 * Renderiza Markdown (com GFM). HTML cru não é interpretado e URLs perigosas (javascript:) são descartadas
 * pelo react-markdown, então o conteúdo de skills e de agentes é tratado como não confiável.
 */
export function MarkdownPreview({ source, className }: { source: string; className?: string }) {
  const { frontmatter, body } = splitFrontmatter(source);

  if (!source.trim()) {
    return <p className={cn("text-sm text-muted-foreground", className)}>Nada para visualizar ainda.</p>;
  }

  return (
    <div
      className={cn(
        "prose prose-sm max-w-none break-words dark:prose-invert prose-headings:tracking-tight prose-pre:border prose-pre:bg-muted prose-pre:text-foreground prose-code:before:content-none prose-code:after:content-none",
        className,
      )}
    >
      {frontmatter !== null && (
        <pre className="not-prose mb-4 overflow-x-auto rounded-lg border bg-muted/50 p-3 font-mono text-xs leading-relaxed">
          {`---\n${frontmatter}\n---`}
        </pre>
      )}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {children}
            </a>
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
