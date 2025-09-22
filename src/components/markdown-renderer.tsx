"use client";

import React from 'react';

const MarkdownRenderer = ({ content }: { content: string }) => {
  const lines = content.split('\n');

  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent = '';
  let codeBlockLang = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('```')) {
      if (inCodeBlock) {
        elements.push(
          <div key={`code-block-${i}`} className="my-4 rounded-md bg-foreground/5 dark:bg-foreground/10">
            <div className="flex items-center justify-between px-4 py-2 border-b">
              <span className="text-xs font-sans text-muted-foreground">{codeBlockLang || 'code'}</span>
            </div>
            <pre className="p-4 text-sm overflow-x-auto">
              <code>{codeBlockContent.trim()}</code>
            </pre>
          </div>
        );
        codeBlockContent = '';
        codeBlockLang = '';
      } else {
        codeBlockLang = line.trim().substring(3);
      }
      inCodeBlock = !inCodeBlock;
    } else if (inCodeBlock) {
      codeBlockContent += line + '\n';
    } else {
      if (line.startsWith('# ')) {
        elements.push(<h1 key={i} className="mt-6 border-b pb-2 text-3xl font-semibold tracking-tight first:mt-0">{line.substring(2)}</h1>);
      } else if (line.startsWith('## ')) {
        elements.push(<h2 key={i} className="mt-8 border-b pb-2 text-2xl font-semibold tracking-tight">{line.substring(3)}</h2>);
      } else if (line.startsWith('### ')) {
        elements.push(<h3 key={i} className="mt-6 text-xl font-semibold tracking-tight">{line.substring(4)}</h3>);
      } else if (line.startsWith('* ') || line.startsWith('- ')) {
        const listItems = [];
        let j = i;
        while (j < lines.length && (lines[j].startsWith('* ') || lines[j].startsWith('- '))) {
          listItems.push(<li key={`li-${j}`} className="pb-1">{lines[j].substring(2)}</li>);
          j++;
        }
        elements.push(<ul key={`list-${i}`} className="my-4 ml-6 list-disc [&>li]:mt-2">{listItems}</ul>);
        i = j - 1; 
      } else if (line.trim() !== '') {
        elements.push(<p key={i} className="leading-7 [&:not(:first-child)]:mt-4">{line}</p>);
      }
    }
  }

  return <div className="prose prose-sm max-w-none dark:prose-invert">{elements}</div>;
};

export default MarkdownRenderer;
