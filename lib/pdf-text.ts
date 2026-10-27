/** 用 unpdf（PDF.js 的 serverless 构建）抽文本。不渲染页面，因此不需要 canvas。 */
export async function readPdfText(data: Uint8Array): Promise<string> {
  const { extractText } = await import("unpdf");
  const extracted = await extractText(data, { mergePages: false });
  const pages = Array.isArray(extracted.text) ? extracted.text : [extracted.text];
  return pages
    .map((page) => page.replace(/[ \t]{2,}/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}
