import assert from "node:assert/strict";
import test from "node:test";
import {
  NEW_CHAT_TITLE,
  assertSessionId,
  formatSessionStamp,
  messageMarkdownSource,
  parseStoredMessages,
  pickSessionAfterDelete,
  prepareSessionDraft,
  prepareSessionMessages,
  sessionOptionLabel,
  sessionTitleFromMessages,
} from "../lib/chat-memory";

test("会话存储只接受带 id、role、parts 的消息", () => {
  const raw = JSON.stringify([
    { id: "1", role: "user", parts: [{ type: "text", text: "还在吗" }] },
    { id: "2", role: "assistant", parts: [{ type: "text", text: "在" }] },
    { role: "user", parts: [] },
    { id: "3", role: "tool", parts: [] },
  ]);
  const messages = parseStoredMessages(raw);
  assert.equal(messages.length, 2);
  assert.equal(messages[0]?.id, "1");
  assert.equal(messages[1]?.role, "assistant");
});

test("复制用的是文本 part 的 Markdown 原文", () => {
  const source = messageMarkdownSource({
    parts: [
      { type: "text", text: "看看 **加粗** 和 [链接](https://example.com/a)" },
      { type: "tool-list_leads", state: "output-available" },
      { type: "text", text: "" },
      { type: "text", text: "第二段 `code`" },
    ],
  });
  assert.equal(source, "看看 **加粗** 和 [链接](https://example.com/a)\n\n第二段 `code`");
  assert.equal(messageMarkdownSource({ parts: [] }), "");
  assert.equal(messageMarkdownSource({}), "");
});

test("损坏的会话存储当成空对话", () => {
  assert.deepEqual(parseStoredMessages(null), []);
  assert.deepEqual(parseStoredMessages("not-json"), []);
  assert.deepEqual(parseStoredMessages(JSON.stringify({ messages: [] })), []);
});

test("会话标题取首条用户消息，空会话叫新对话", () => {
  assert.equal(sessionTitleFromMessages([]), NEW_CHAT_TITLE);
  assert.equal(
    sessionTitleFromMessages([
      { role: "assistant", parts: [{ type: "text", text: "先说一句" }] },
      { role: "user", parts: [{ type: "text", text: "  对照\n政策  " }] },
    ]),
    "对照 政策",
  );
  assert.equal(sessionTitleFromMessages([{ role: "user", parts: [{ type: "text", text: "   " }] }]), NEW_CHAT_TITLE);
  const long = "对照已有政策和案例，说说我们现在做什么";
  assert.equal(sessionTitleFromMessages([{ role: "user", parts: [{ type: "text", text: long }] }]), "对照已有政策和案例，说说我们现在做什…");
});

test("会话选项带上北京时间", () => {
  assert.equal(formatSessionStamp("2026-10-27T12:50:00.000Z"), "10-27 20:50");
  assert.equal(formatSessionStamp("not-a-date"), "");
  assert.equal(sessionOptionLabel("新对话", "2026-10-27T12:50:00.000Z"), "新对话 · 10-27 20:50");
});

test("删掉当前会话后落到剩下的第一条", () => {
  const sessions = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.equal(pickSessionAfterDelete(sessions, "a")?.id, "b");
  assert.equal(pickSessionAfterDelete(sessions, "b")?.id, "a");
  assert.equal(pickSessionAfterDelete([{ id: "a" }], "a"), null);
});

test("写入前拒绝坏消息、超长草稿和不像 uuid 的会话 id", () => {
  assert.throws(() => prepareSessionMessages({}), /messages 需要是数组/);
  assert.throws(() => prepareSessionMessages([{ role: "user", parts: [] }]), /缺少 id/);
  assert.throws(() => prepareSessionDraft(1), /草稿需要是字符串/);
  assert.throws(() => prepareSessionDraft("x".repeat(20_001)), /草稿太长/);
  assert.throws(() => assertSessionId("../etc"), /会话 id 不正确/);
  assert.doesNotThrow(() => assertSessionId(crypto.randomUUID()));
  const kept = prepareSessionMessages([{ id: "1", role: "user", parts: [{ type: "text", text: "在" }] }]);
  assert.equal(kept.length, 1);
});
