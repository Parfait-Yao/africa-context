import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { cn } from "@/lib/utils"

/**
 * Rendu Markdown assaini : react-markdown n'interprète pas le HTML brut
 * (pas de rehype-raw), ce qui ferme la porte au XSS via le contenu soumis.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div className={cn("min-w-0 text-[0.95rem] leading-7 [overflow-wrap:anywhere]", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          h2: ({ children }) => (
            <h2 className="mt-10 mb-3 scroll-mt-24 border-b pb-2 text-xl font-semibold tracking-tight first:mt-0" id={slugify(String(children))}>
              {children}
            </h2>
          ),
          h3: ({ children }) => <h3 className="mt-6 mb-2 text-lg font-semibold">{children}</h3>,
          p: ({ children }) => <p className="my-3">{children}</p>,
          ul: ({ children }) => <ul className="my-3 list-disc space-y-1 pl-6">{children}</ul>,
          ol: ({ children }) => <ol className="my-3 list-decimal space-y-1 pl-6">{children}</ol>,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow" className="font-medium text-primary underline underline-offset-4">
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-4 w-full overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted/60">{children}</thead>,
          th: ({ children }) => <th className="px-3 py-2 font-semibold whitespace-nowrap [overflow-wrap:normal]">{children}</th>,
          td: ({ children }) => <td className="border-t px-3 py-2 align-top [overflow-wrap:normal]">{children}</td>,
          pre: ({ children }) => (
            <pre className="my-4 overflow-x-auto [overflow-wrap:normal] rounded-lg bg-code-bg p-4 text-[0.82rem] leading-6 text-code-fg">{children}</pre>
          ),
          code: ({ children, className }) =>
            className ? (
              <code className={className}>{children}</code>
            ) : (
              <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">{children}</code>
            ),
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          blockquote: ({ children }) => <blockquote className="my-4 border-l-2 pl-4 text-muted-foreground">{children}</blockquote>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}
