import assert from "node:assert/strict";
import test from "node:test";
import { CHAT_TOOL_STEPS, TOOL_ADDENDUM } from "../lib/prompt.ts";
import { openAiChatReasoningOptions } from "../lib/chat-reasoning.ts";

test("默认模型和自定义网关不打开 reasoning", () => {
  assert.equal(openAiChatReasoningOptions("gpt-4o-mini"), undefined);
  assert.equal(openAiChatReasoningOptions("gpt-4.1-mini", "https://api.openai.com/v1"), undefined);
  assert.equal(openAiChatReasoningOptions("gpt-5-chat-latest"), undefined);
  assert.equal(openAiChatReasoningOptions("deepseek-reasoner", "https://api.deepseek.com"), undefined);
  assert.equal(openAiChatReasoningOptions("o3", "https://openrouter.ai/api/v1"), undefined);
  assert.equal(openAiChatReasoningOptions("o3", "http://api.openai.com/v1"), undefined);
});

test("官方 OpenAI 推理模型使用 low effort，不要求展示思考过程", () => {
  assert.deepEqual(openAiChatReasoningOptions("o3"), { reasoningEffort: "low" });
  assert.deepEqual(openAiChatReasoningOptions(" o4-mini "), { reasoningEffort: "low" });
  assert.deepEqual(openAiChatReasoningOptions("gpt-5-mini", "https://api.openai.com/v1"), { reasoningEffort: "low" });
  assert.deepEqual(openAiChatReasoningOptions("gpt-5.4", "https://api.openai.com/v1/"), { reasoningEffort: "low" });
  assert.match(TOOL_ADDENDUM, /不要把推理草稿|不要把思考过程写进/);
  assert.ok(CHAT_TOOL_STEPS >= 10);
});
