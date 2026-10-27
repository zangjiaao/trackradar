import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assessmentInputText, excerptAttachmentText, listPdfAttachments, storedNoticeBody } from "../lib/article-attachments.ts";
import { fetchPolicyArticle } from "../lib/fetch-article.ts";

const catalogHtml = readFileSync(new URL("./fixtures/xa-catalog-notice.html", import.meta.url), "utf8");
const acceptanceHtml = readFileSync(new URL("./fixtures/xa-acceptance-attachment.html", import.meta.url), "utf8");

const catalogTitle = "关于发布《2026年新产品新技术目录清单（第一期）》的通知";
const catalogPage = "https://gxj.xa.gov.cn/gzdt/tzgg/2110279543487565825.html";
const catalogPdf = "https://gxj.xa.gov.cn/web_files/gxj/file/2026/10/14/202610141559118299702.pdf";

function pdfBytes(text: string): Uint8Array {
  return new TextEncoder().encode(`%PDF-1.4 mock\n${text}`);
}

function htmlResponse(html: string): Response {
  return new Response(html, { status: 200, headers: { "content-type": "text/html; charset=utf-8" } });
}

test("目录页上的附件 PDF 会被解析成绝对地址", () => {
  assert.deepEqual(listPdfAttachments(catalogHtml, catalogPage), [catalogPdf]);
});

test("附件 PDF 的产品名进入评估输入，长概述不会把摘录截掉", async () => {
  const padding = `页眉导航重复${"政务公开".repeat(400)}。`;
  const html = catalogHtml.replace("<h1>", `<p>${padding}</p><h1>`);
  const catalogText = [
    "建材产品".repeat(800),
    "人工智能 企业知识库 LiveKnowledge",
    "数字员工 LiveStaff",
    "领域智能体 RAG",
    "工业大模型",
    "输配电设备".repeat(800),
  ].join("\n");
  let seenPdf = false;
  const article = await fetchPolicyArticle(catalogPage, {
    fetch: async (url) => {
      if (url === catalogPdf) {
        seenPdf = true;
        return new Response(pdfBytes(catalogText), {
          status: 200,
          headers: { "content-type": "application/pdf", "content-length": "1200" },
        });
      }
      return htmlResponse(html);
    },
    readPdf: async (bytes) => new TextDecoder().decode(bytes).replace(/^%PDF-1\.4 mock\n/, ""),
  });

  assert.equal(seenPdf, true);
  assert.ok(article);
  assert.equal(article.publishedAt, "2026-10-14 15:59");
  const stored = storedNoticeBody(catalogTitle, article.text);
  const input = assessmentInputText(stored);
  assert.match(input, /【附件摘录】/);
  assert.match(input, /企业知识库 LiveKnowledge/);
  assert.match(input, /数字员工 LiveStaff/);
  assert.match(input, /领域智能体 RAG/);
  assert.match(input, /工业大模型/);
  const excerptAt = input.indexOf("【附件摘录】");
  assert.ok(excerptAt > 0);
  assert.ok(excerptAt < input.length - 20);
});

test("验收公示的名单 PDF 没有关键词时仍进入评估输入", async () => {
  const page = "https://gxj.xa.gov.cn/gzdt/tzgg/2104492035763965953.html";
  const pdfUrl = "https://gxj.xa.gov.cn/gzdt/tzgg/files/acceptance-names.pdf";
  const names = ["1. 西安星河软件科技有限公司", "2. 西安秦岭数据技术有限公司", "3. 西咸新区云启信息技术有限公司"].join("\n");
  const article = await fetchPolicyArticle(page, {
    fetch: async (url) => {
      if (url === pdfUrl) {
        return new Response(pdfBytes(names), { status: 200, headers: { "content-type": "application/pdf" } });
      }
      return htmlResponse(acceptanceHtml);
    },
    readPdf: async (bytes) => new TextDecoder().decode(bytes).replace(/^%PDF-1\.4 mock\n/, ""),
  });
  assert.ok(article);
  const input = assessmentInputText(storedNoticeBody("关于公布数字化转型试点第二批通过验收企业的公示", article.text));
  assert.match(input, /西安星河软件科技有限公司/);
  assert.match(input, /西安秦岭数据技术有限公司/);
});

test("超长附件优先保留人工智能和知识库片段，名单则保留开头", () => {
  const noise = "普通制造条目".repeat(500);
  const excerpt = excerptAttachmentText(`${noise}\n人工智能 企业知识库 LiveKnowledge\n${noise}`, 180);
  assert.match(excerpt, /企业知识库 LiveKnowledge/);
  assert.ok(excerpt.length <= 180);
  const roster = excerptAttachmentText(`${"甲公司\n".repeat(80)}乙公司`, 40);
  assert.match(roster, /^甲公司/);
  assert.doesNotMatch(roster, /人工智能/);
});
