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
              title="新增机会 / 素材"
              subtitle="人工找到的材料写在这里。可以先让 Agent 补全赛道、解读和机会说明。"
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
