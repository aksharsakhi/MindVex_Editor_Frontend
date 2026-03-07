import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { useStore } from '@nanostores/react';
import { themeStore } from '~/lib/stores/theme';
import type { ReactNode } from 'react';
import 'github-markdown-css/github-markdown.css';

interface MarkdownRendererProps {
  content: string;
}

interface CodeProps {
  node?: any;
  inline?: boolean;
  className?: string;
  children?: ReactNode;
  [key: string]: any;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  const theme = useStore(themeStore);
  const isDark = theme === 'dark';

  return (
    <div className="markdown-preview-container h-full overflow-auto bg-mindvex-background-depth1">
      <div className="markdown-body p-6 max-w-4xl mx-auto">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw, rehypeSanitize]}
          components={{
            code({ inline, className, children, ...props }: CodeProps) {
              const match = /language-(\w+)/.exec(className || '');
              const language = match ? match[1] : '';

              return !inline && language ? (
                <SyntaxHighlighter
                  style={isDark ? vscDarkPlus : vs}
                  language={language}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    borderRadius: '8px',
                    backgroundColor: isDark ? 'var(--background-depth-3, #27272a)' : '#f6f8fa',
                  }}
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              ) : (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>

      <style>{`
        .markdown-preview-container {
          background: var(--background-depth-1);
        }
        
        .markdown-body {
          background: var(--background-depth-1) !important;
          color: var(--text-primary, #e4e4e7);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans', Helvetica, Arial, sans-serif;
        }
        
        .markdown-body h1,
        .markdown-body h2,
        .markdown-body h3,
        .markdown-body h4,
        .markdown-body h5,
        .markdown-body h6 {
          color: var(--text-primary, #e4e4e7);
          border-bottom-color: var(--mindvex-elements-borderColor, #3f3f46);
        }
        
        .markdown-body a {
          color: var(--mindvex-accent-primary, #3b82f6);
        }
        
        .markdown-body a:hover {
          color: var(--mindvex-accent-primaryHover, #60a5fa);
        }
        
        .markdown-body code {
          background-color: var(--background-depth-3, #27272a);
          color: var(--text-primary, #e4e4e7);
          border-radius: 6px;
          padding: 0.2em 0.4em;
        }
        
        .markdown-body pre {
          background-color: var(--background-depth-3, #27272a) !important;
          border: 1px solid var(--mindvex-elements-borderColor, #3f3f46);
          border-radius: 8px;
        }
        
        .markdown-body pre code {
          background-color: transparent;
          padding: 0;
        }
        
        .markdown-body blockquote {
          color: var(--text-secondary, #a1a1aa);
          border-left-color: var(--mindvex-elements-borderColor, #3f3f46);
        }
        
        .markdown-body table {
          border-color: var(--mindvex-elements-borderColor, #3f3f46);
        }
        
        .markdown-body table tr {
          background-color: var(--background-depth-1, #18181b);
          border-top-color: var(--mindvex-elements-borderColor, #3f3f46);
        }
        
        .markdown-body table tr:nth-child(2n) {
          background-color: var(--background-depth-2, #1f1f23);
        }
        
        .markdown-body table th,
        .markdown-body table td {
          border-color: var(--mindvex-elements-borderColor, #3f3f46);
        }
        
        .markdown-body hr {
          background-color: var(--mindvex-elements-borderColor, #3f3f46);
          border: none;
        }
        
        .markdown-body ul,
        .markdown-body ol {
          color: var(--text-primary, #e4e4e7);
        }
        
        .markdown-body img {
          border-radius: 8px;
          max-width: 100%;
        }
        
        /* Task list styling */
        .markdown-body .task-list-item {
          list-style-type: none;
        }
        
        .markdown-body .task-list-item input {
          margin-right: 0.5em;
        }
      `}</style>
    </div>
  );
}
