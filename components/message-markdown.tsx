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
