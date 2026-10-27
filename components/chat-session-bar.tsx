"use client";

import { useEffect, useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Selector } from "@astryxdesign/core/Selector";
import { Text } from "@astryxdesign/core/Text";
import { sessionOptionLabel } from "@/lib/chat-memory";
import { createChatSession, deleteActiveChatSession, switchChatSession, type ChatBrowserSnapshot } from "@/components/chat-session";

export function ChatSessionBar({ snapshot }: { snapshot: ChatBrowserSnapshot }) {
  const { ready, pending, sessions, activeId, error } = snapshot;
  const [armed, setArmed] = useState(false);
  const selected = activeId !== null && sessions.some((session) => session.id === activeId);

  useEffect(() => {
    setArmed(false);
  }, [activeId]);

  return (
    <HStack gap={2} vAlign="center" wrap="wrap" className="chat-session-bar">
      {selected && activeId ? (
        <div className="chat-session-select">
          <Selector
            label="会话"
            isLabelHidden
            size="sm"
            variant="secondary"
            width="100%"
            value={activeId}
            isDisabled={!ready || pending}
            options={sessions.map((session) => ({
              value: session.id,
              label: sessionOptionLabel(session.title, session.updated_at),
            }))}
            onChange={(value) => {
              void switchChatSession(value);
            }}
          />
        </div>
      ) : (
        <Text type="supporting">{ready ? "没有可切换的会话" : "正在打开会话"}</Text>
      )}
      <Button label="新对话" size="sm" variant="ghost" isDisabled={!ready || pending} onClick={() => void createChatSession()} />
      <Button
        label={armed ? "确认删除" : "删除"}
        size="sm"
        variant={armed ? "destructive" : "ghost"}
        isDisabled={!ready || pending || !activeId}
        onClick={() => {
          if (!armed) {
            setArmed(true);
            return;
          }
          setArmed(false);
          void deleteActiveChatSession();
        }}
      />
      {error ? (
        <Text type="supporting" as="p">
          {error}
        </Text>
      ) : null}
    </HStack>
  );
}
