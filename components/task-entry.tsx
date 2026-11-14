"use client";

import { useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Layout, LayoutContent } from "@astryxdesign/core/Layout";
import { TaskForm } from "@/components/task-form";

export function TaskEntry() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button label="添加任务" variant="primary" onClick={() => setOpen(true)} />
      <Dialog isOpen={open} onOpenChange={setOpen} purpose="form">
        <Layout
          header={
            <DialogHeader
              title="添加采集任务"
              subtitle="选择采集目标和执行周期。保存后可在列表立即执行。"
              onOpenChange={setOpen}
            />
          }
          content={
            <LayoutContent padding={4}>
              <TaskForm onSaved={() => setOpen(false)} />
            </LayoutContent>
          }
        />
      </Dialog>
    </>
  );
}
