import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { MessageMarkdown } from "../components/message-markdown";
import { isSafeHref } from "../lib/safe-href";

test("链接只允许 http、https、mailto 和站内相对地址", () => {
  assert.equal(isSafeHref("https://www.sheitc.sh.gov.cn/"), true);
  assert.equal(isSafeHref("http://gxj.sz.gov.cn/xxgk/xxgkml/qt/tzgg/"), true);
  assert.equal(isSafeHref("mailto:studio@example.com"), true);
  assert.equal(isSafeHref("/leads"), true);
  assert.equal(isSafeHref("#t06"), true);
  assert.equal(isSafeHref("javascript:alert(1)"), false);
  assert.equal(isSafeHref(" JavaScript:alert(1)"), false);
  assert.equal(isSafeHref("data:text/html,hi"), false);
  assert.equal(isSafeHref("//evil.example"), false);
});

test("消息 Markdown 渲染结构且不执行 HTML", () => {
  const html = renderToStaticMarkup(
    createElement(MessageMarkdown, {
      streaming: false,
      text: [
        "# 标题",
        "",
        "- 一项",
        "",
        "```js",
        "const a = 1",
        "```",
        "",
        "[安全](https://example.com/path)",
        "",
        "[危险](javascript:alert(1))",
        "",
        "<script>alert(1)</script>",
        "",
        '<img src="https://evil.test/x.png" alt="像素" />',
        "",
        "![追踪](https://tracker.example/pixel.png)",
        "",
        "<b onclick=\"alert(1)\">加粗</b>",
      ].join("\n"),
    }),
  );

  assert.match(html, /<h1[\s>]/);
  assert.match(html, /<li[\s>]/);
  assert.match(html, /<pre[\s>]/);
  assert.match(html, /const a = 1/);
  assert.match(html, /href="https:\/\/example.com\/path"/);
  assert.match(html, /rel="noreferrer noopener"/);
  assert.match(html, /target="_blank"/);
  assert.equal(html.includes("javascript:"), false);
  assert.equal(/<script[\s>]/i.test(html), false);
  assert.equal(/<img[\s>]/i.test(html), false);
  assert.equal(/<b[\s>]/i.test(html), false);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(html, /像素/);
  assert.equal(html.includes("tracker.example"), false);
});

test("表格、标题和安全链接能渲染", () => {
  const html = renderToStaticMarkup(
    createElement(MessageMarkdown, {
      streaming: false,
      text: ["## 回复会按 Markdown 排版", "", "| 赛道 | 切口 |", "| --- | --- |", "| T06 | 通知 |", "", "政策原文见 [上海市经信委](https://www.sheitc.sh.gov.cn/)。"].join("\n"),
    }),
  );
  assert.match(html, /<h2[\s>]/);
  assert.match(html, /<table[\s>]/);
  assert.match(html, /href="https:\/\/www.sheitc.sh.gov.cn\/"/);
  assert.match(html, /rel="noreferrer noopener"/);
});

test("未闭合代码块在流式模式下仍可渲染", () => {
  const html = renderToStaticMarkup(
    createElement(MessageMarkdown, {
      streaming: true,
      text: "## 进行中\n\n```js\nconst a =",
    }),
  );
  assert.match(html, /进行中/);
  assert.match(html, /const a =/);
  assert.equal(html.includes("<script"), false);
});
