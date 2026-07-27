"use client";

import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { useState } from "react";
import { Check, Copy } from "lucide-react";

function CodeBlock({ language, children }: { language?: string; children: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="group relative my-2 overflow-hidden rounded-lg border border-border">
      <div className="flex items-center justify-between bg-muted/60 px-3 py-1.5 text-xs text-muted-foreground">
        <span>{language ?? "code"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
          aria-label={copied ? "Copied" : "Copy code"}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto bg-[#0d1117] p-4 text-sm leading-relaxed">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded-md bg-muted px-1.5 py-0.5 text-sm font-medium text-foreground">
      {children}
    </code>
  );
}

export function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          code({ className, children }) {
            const match = (className ?? "").match(/language-(\w+)/);
            const isInline = !match && !className;
            const codeString = String(children).replace(/\n$/, "");
            if (isInline) {
              return <InlineCode>{children}</InlineCode>;
            }
            return <CodeBlock language={match?.[1]}>{codeString}</CodeBlock>;
          },
          pre({ children }) {
            return <>{children}</>;
          },
          a({ href, children }) {
            return (
              <a href={href} target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2 hover:text-primary/80">
                {children}
              </a>
            );
          },
          table({ children }) {
            return (
              <div className="overflow-x-auto my-2 rounded-lg border border-border">
                <table className="min-w-full divide-y divide-border text-sm">{children}</table>
              </div>
            );
          },
          th({ children }) {
            return <th className="bg-muted/50 px-3 py-2 text-left font-medium text-muted-foreground">{children}</th>;
          },
          td({ children }) {
            return <td className="px-3 py-2">{children}</td>;
          },
          ul({ children }) {
            return <ul className="my-1 list-disc space-y-0.5 pl-5">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="my-1 list-decimal space-y-0.5 pl-5">{children}</ol>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="my-2 border-l-2 border-primary/30 pl-4 italic text-muted-foreground">
                {children}
              </blockquote>
            );
          },
          hr() {
            return <hr className="my-4 border-border" />;
          },
          p({ children }) {
            return <p className="my-1.5 leading-relaxed">{children}</p>;
          },
          h1({ children }) {
            return <h1 className="mb-2 mt-4 text-lg font-semibold">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="mb-1.5 mt-3.5 text-base font-semibold">{children}</h2>;
          },
          h3({ children }) {
            return <h3 className="mb-1 mt-3 text-sm font-semibold">{children}</h3>;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
