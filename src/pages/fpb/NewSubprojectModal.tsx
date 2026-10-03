import { useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { COLUMN_COLORS } from "@/pages/fpb/shared";

/**
 * Adds a sub-project to a project. A project (say the brand "Kunzul Channar")
 * is split into sub-projects like Social Media, Development, SEO or Marketing;
 * the board then runs one sub-project at a time. Opened from the sub-project
 * switcher next to the project title.
 */
export function NewSubprojectModal({
  open, onClose, projectId, projectTitle, onCreated, tokens,
}: {
  open: boolean; onClose: () => void; projectId: string;
  projectTitle: string; onCreated: (id: string) => void; tokens: any;
}) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLUMN_COLORS[0]);

  const reset = () => { setName(""); setColor(COLUMN_COLORS[0]); };

  const create = trpc.fpb.createSubproject.useMutation({
    onSuccess: (created: any) => {
      utils.fpb.getBoard.invalidate({ projectId });
      toast.success("Sub-project created");
      reset();
      onCreated(created.id);
      onClose();
    },
    onError: (e: any) => toast.error(e?.message || "Could not create the sub-project"),
  });

  const submit = () => {
    if (!name.trim()) return;
    create.mutate({ projectId, name: name.trim(), color });
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) { reset(); onClose(); } }}>
      <DialogContent className={`${tokens.dialog} max-w-sm`}>
        <DialogHeader>
          <DialogTitle className="font-semibold">New Sub-project</DialogTitle>
          <DialogDescription className={tokens.textMuted}>
            A division of {projectTitle} — like Social Media, Development, SEO or Marketing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <label className={`text-xs mb-1 block ${tokens.textMuted}`}>Sub-project Name *</label>
            <Input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
              placeholder="e.g. Development"
              className={tokens.input}
            />
          </div>

          <div>
            <label className={`text-xs mb-1.5 block ${tokens.textMuted}`}>Colour</label>
            <div className="flex gap-2 flex-wrap">
              {COLUMN_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Colour ${c}`}
                  style={{ backgroundColor: c }}
                  className={`w-6 h-6 rounded-full transition-transform ${
                    color === c ? "ring-2 ring-offset-2 ring-[#4233e0] ring-offset-transparent scale-110" : ""
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => { reset(); onClose(); }} className={tokens.btnGhost}>
              Cancel
            </Button>
            <Button
              onClick={submit}
              disabled={!name.trim() || create.isPending}
              className="bg-[#4233e0] hover:bg-[#2a1fb0] text-white"
            >
              {create.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</>
                : "Create Sub-project"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
