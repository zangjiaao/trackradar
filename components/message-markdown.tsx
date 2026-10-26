"use client";

import React, { createElement, type ComponentProps } from "react";
import { harden } from "rehype-harden";
import { Streamdown, defaultRehypePlugins, type StreamdownProps } from "streamdown";
import { isSafeHref } from "@/lib/safe-href";

const rehypePlugins: NonNullable<StreamdownProps["rehypePlugins"]> = [
  defaultRehypePlugins.sanitize,
  [
    harden,
    {
      allowedProtocols: ["http", "https", "mailto"],
      allowedLinkPrefixes: ["*"],
      allowedImagePrefixes: ["*"],
      allowDataImages: false,
      linkBlockPolicy: "text-only",
      imageBlockPolicy: "remove",
    },
  ],
];

const markdownComponents = {
  a: MarkdownLink,
  h1: compactHeading("h1", "mt-1 mb-1 text-base font-semibold"),
  h2: compactHeading("h2", "mt-1 mb-1 text-[0.95rem] font-semibold"),
  h3: compactHeading("h3", "mt-1 mb-1 text-sm font-semibold"),
  h4: compactHeading("h4", "mt-1 mb-1 text-sm font-semibold"),
  pre: MarkdownPre,
  code: MarkdownCode,
};

function safeUrlTransform(url: string): string {
  return isSafeHref(url) ? url : "";
}

function MarkdownLink({ href, children, node: _node, ...props }: ComponentProps<"a"> & { node?: unknown }) {
  if (!href || !isSafeHref(href)) return <span>{children}</span>;
  const external = /^https?:/i.test(href);
  return (
    <a
      {...props}
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer noopener" } : {})}
    >
      {children}
    </a>
  );
}

function compactHeading(tag: "h1" | "h2" | "h3" | "h4", className: string) {
  return function Heading({ children, node: _node, ...props }: ComponentProps<typeof tag> & { node?: unknown }) {
    return createElement(tag, { ...props, className }, children);
  };
}

function MarkdownPre({ children, node: _node, ...props }: ComponentProps<"pre"> & { node?: unknown }) {
  return <pre {...props}>{children}</pre>;
}

function MarkdownCode({ children, className, node: _node, ...props }: ComponentProps<"code"> & { node?: unknown }) {
  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
}

export function MessageMarkdown({ text, streaming }: { text: string; streaming: boolean }) {
  return (
    <Streamdown
      className="chat-md"
      mode={streaming ? "streaming" : "static"}
      parseIncompleteMarkdown={streaming}
      isAnimating={streaming}
      animated={false}
      controls={false}
      linkSafety={{ enabled: false }}
      skipHtml
      disallowedElements={["img", "script", "iframe", "object", "embed", "style"]}
      unwrapDisallowed
      rehypePlugins={rehypePlugins}
      components={markdownComponents}
      urlTransform={safeUrlTransform}
    >
      {text}
    </Streamdown>
  );
}

export const FORMAT_SAMPLE = [
  "## 回复会按 Markdown 排版",
  "",
  "助手和你的消息都会解析这些结构，未写完的标记在流式输出时按当前内容显示。",
  "",
  "- 标题、列表和引用",
  "- `行内代码` 与代码块",
  "- 链接只保留 http、https、mailto",
  "",
  "> 原始 HTML 不会执行。",
  "",
  "| 赛道 | 切口 |",
  "| --- | --- |",
  "| T06 | 把一份通知拆成可检索条目 |",
  "| T10 | 对照入库条件整理材料清单 |",
  "",
  "```text",
  "demo：通知标题、适用范围、截止日期",
  "```",
  "",
  "政策原文见 [上海市经信委](https://www.sheitc.sh.gov.cn/)。",
].join("\n");
