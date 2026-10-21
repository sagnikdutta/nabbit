import React, { useState } from 'react';
import { Check, Copy, AlertCircle, CheckCircle } from 'lucide-react';

export interface CodeBlockProps {
  code: string;
  highlightLines?: number[];
  variant?: 'bug' | 'fix' | 'neutral';
  showLineNumbers?: boolean;
  filename?: string;
  onLineClick?: (lineNum: number) => void;
  selectedLine?: number | null;
}

// Tokenize a single line of JS/TS/JSX code into semantic tokens
function highlightSyntax(line: string): React.ReactNode[] {
  if (!line) return ['\n'];

  // Check for line comments
  const commentIndex = line.indexOf('//');
  if (commentIndex !== -1) {
    const before = line.slice(0, commentIndex);
    const comment = line.slice(commentIndex);
    return [
      ...tokenizeLine(before),
      <span key="comment" className="tok-comment">{comment}</span>,
    ];
  }

  return tokenizeLine(line);
}

function tokenizeLine(text: string): React.ReactNode[] {
  const tokens: React.ReactNode[] = [];
  // Regex to match strings, keywords, numbers, JSX tags, and punctuation
  const tokenRegex = /(".*?"|'.*?'|`.*?`|\b(?:function|const|let|var|return|if|else|async|await|try|catch|throw|interface|type|new|from|import|export|default|null|undefined|true|false)\b|\b(?:useState|useEffect|useRef|useMemo|useCallback|setInterval|clearInterval|addEventListener|removeEventListener|fetch|map|forEach|push|slice|filter|json|log|error|all|allSettled)\b|\b\d+\b|<\/?[A-Z][a-zA-Z0-9]*|<\/?[a-z]+|[{}()[\];:,.<>+=!&|?-]|\s+|[a-zA-Z_$][a-zA-Z0-9_$]*)/g;

  let match;
  let keyIdx = 0;

  while ((match = tokenRegex.exec(text)) !== null) {
    const token = match[0];
    keyIdx++;

    if (/^["'`]/.test(token)) {
      tokens.push(<span key={keyIdx} className="tok-str">{token}</span>);
    } else if (
      /^(?:function|const|let|var|return|if|else|async|await|try|catch|throw|interface|type|new|from|import|export|default|null|undefined|true|false)$/.test(
        token
      )
    ) {
      tokens.push(<span key={keyIdx} className="tok-kw">{token}</span>);
    } else if (
      /^(?:useState|useEffect|useRef|useMemo|useCallback|setInterval|clearInterval|addEventListener|removeEventListener|fetch|map|forEach|push|slice|filter|json|log|error|all|allSettled)$/.test(
        token
      )
    ) {
      tokens.push(<span key={keyIdx} className="tok-fn">{token}</span>);
    } else if (/^\d+$/.test(token)) {
      tokens.push(<span key={keyIdx} className="tok-num">{token}</span>);
    } else if (/^<\/?[a-zA-Z]/.test(token)) {
      tokens.push(<span key={keyIdx} className="tok-tag">{token}</span>);
    } else if (/^[{}()[\];:,.<>+=!&|?-]$/.test(token)) {
      tokens.push(<span key={keyIdx} className="tok-punc">{token}</span>);
    } else {
      tokens.push(<span key={keyIdx} className="tok-plain">{token}</span>);
    }
  }

  if (tokens.length === 0) {
    return [text];
  }

  return tokens;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  highlightLines = [],
  variant = 'neutral',
  showLineNumbers = true,
  filename,
  onLineClick,
  selectedLine,
}) => {
  const [copied, setCopied] = useState(false);
  const lines = code.trimEnd().split('\n');

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="rounded-[var(--radius)] overflow-hidden border border-[var(--color-border)] bg-[var(--code-bg)] font-mono text-[13px] leading-[1.65] shadow-[var(--shadow-sm)]">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--code-border)] bg-[var(--code-surface)] text-[var(--color-muted)] text-xs">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/30" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/30" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/30" />
          </div>
          {filename && <span className="font-mono text-[11px] text-[var(--code-text)] opacity-70 ml-2">{filename}</span>}
        </div>

        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-sm)] text-[11px] text-[var(--code-text)] opacity-75 hover:opacity-100 hover:bg-white/10 transition-all cursor-pointer"
          title="Copy code"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-[var(--color-good)]" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
      </div>

      {/* Code Body */}
      <div className="overflow-x-auto py-3">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => {
              const lineNum = idx + 1;
              const isHighlighted = highlightLines.includes(lineNum);
              const isSelected = selectedLine === lineNum;

              let lineBgClass = '';
              let gutterMarker = null;

              if (isHighlighted) {
                if (variant === 'bug') {
                  lineBgClass = 'bg-[var(--code-bug)] border-l-2 border-[var(--code-bug-border)]';
                  gutterMarker = (
                    <span title="Planted flaw candidate line" className="text-[var(--code-bug-border)]">
                      <AlertCircle className="w-3.5 h-3.5 inline -mt-0.5" />
                    </span>
                  );
                } else if (variant === 'fix') {
                  lineBgClass = 'bg-[var(--code-fix)] border-l-2 border-[var(--code-fix-border)]';
                  gutterMarker = (
                    <span title="Corrected implementation" className="text-[var(--code-fix-border)]">
                      <CheckCircle className="w-3.5 h-3.5 inline -mt-0.5" />
                    </span>
                  );
                } else {
                  lineBgClass = 'bg-white/5';
                }
              }

              if (isSelected) {
                lineBgClass = 'bg-[var(--color-accent-weak)] border-l-2 border-[var(--color-accent)]';
              }

              return (
                <tr
                  key={lineNum}
                  onClick={() => onLineClick?.(lineNum)}
                  className={`transition-colors group ${lineBgClass} ${onLineClick ? 'cursor-pointer hover:bg-white/5' : ''}`}
                >
                  {showLineNumbers && (
                    <td className="w-12 text-right pr-3 pl-3 select-none text-[var(--code-line-num)] tabular-nums align-top text-xs opacity-60">
                      <div className="flex items-center justify-end gap-1.5">
                        {gutterMarker}
                        <span>{lineNum}</span>
                      </div>
                    </td>
                  )}
                  <td className="pl-2 pr-6 whitespace-pre font-mono text-[var(--code-text)] align-top">
                    {highlightSyntax(line)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
