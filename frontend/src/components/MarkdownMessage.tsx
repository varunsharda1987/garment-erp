/**
 * MarkdownMessage
 *
 * Renders AI assistant reply content as formatted markdown inside a chat bubble.
 * Uses a Tailwind component map (theme tokens) instead of a typography plugin so
 * light/dark colors stay consistent with the rest of the app.
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownMessageProps {
  content: string;
}

export function MarkdownMessage({ content }: MarkdownMessageProps) {
  return (
    <div className="text-sm [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Chat bubbles don't need giant type — all heading levels render small
          h1: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-1">{children}</h3>,
          h2: ({ children }) => <h3 className="text-base font-semibold mt-3 mb-1">{children}</h3>,
          h3: ({ children }) => <h4 className="text-sm font-semibold mt-3 mb-1">{children}</h4>,
          h4: ({ children }) => <h5 className="text-sm font-semibold mt-2 mb-1">{children}</h5>,
          p: ({ children }) => <p className="my-1.5 leading-relaxed">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 my-1.5 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 my-1.5 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          table: ({ children }) => (
            <div className="overflow-x-auto my-2 rounded-md border border-border">
              <table className="w-full text-sm border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-muted">{children}</thead>,
          th: ({ children }) => <th className="border-b border-border px-2 py-1 text-left font-medium">{children}</th>,
          td: ({ children }) => <td className="border-b border-border px-2 py-1 align-top">{children}</td>,
          code: ({ children, className }) => {
            // Block code gets a className like "language-x" from the pre wrapper
            const isBlock = className?.includes('language-');
            return isBlock ? (
              <code className={`${className} text-xs font-mono`}>{children}</code>
            ) : (
              <code className="bg-muted px-1 py-0.5 rounded text-xs font-mono">{children}</code>
            );
          },
          pre: ({ children }) => <pre className="bg-muted rounded-md p-3 my-2 overflow-x-auto text-xs">{children}</pre>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border pl-3 my-1.5 text-muted-foreground">{children}</blockquote>
          ),
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2"
            >
              {children}
            </a>
          ),
          hr: () => <hr className="my-3 border-border" />,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
