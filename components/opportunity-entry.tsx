"use client";

import { useState } from "react";
import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Layout, LayoutContent } from "@astryxdesign/core/Layout";
import { OpportunityForm } from "@/components/opportunity-form";

type TrackOption = { code: string; name: string };

export function OpportunityEntry({ tracks }: { tracks: TrackOption[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div id="entry">
      <Button label="新增" variant="primary" onClick={() => setOpen(true)} />
      <Dialog isOpen={open} onOpenChange={setOpen} width="min(32rem, calc(100vw - 2rem))" purpose="form" maxHeight="85dvh">
        <Layout
          header={
            <DialogHeader
              title="新增案例"
              subtitle="猪八戒、OPC、58、小红书、Fiverr 上看到的求购或接单写在这里。对话里可以和政策放在一起，问现在做什么有助于发展。"
              onOpenChange={setOpen}
            />
          }
          content={
            <LayoutContent className="entry-dialog-body" padding={4} isScrollable={false}>
              <OpportunityForm tracks={tracks} onSaved={() => setOpen(false)} />
            </LayoutContent>
          }
        />
      </Dialog>
    </div>
  );
}
