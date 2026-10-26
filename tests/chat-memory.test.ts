import assert from "node:assert/strict";
import test from "node:test";
import { parseStoredMessages } from "../lib/chat-memory";

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

test("损坏的会话存储当成空对话", () => {
  assert.deepEqual(parseStoredMessages(null), []);
  assert.deepEqual(parseStoredMessages("not-json"), []);
  assert.deepEqual(parseStoredMessages(JSON.stringify({ messages: [] })), []);
});
