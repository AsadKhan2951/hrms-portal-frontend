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

/** Adds one column to a project's own board. */
export function AddColumnModal({
  open, onClose, projectId, tokens,
}: { open: boolean; onClose: () => void; projectId: string; tokens: any }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLUMN_COLORS[0]);

  const create = trpc.fpb.createColumn.useMutation({
    onSuccess: () => {
      utils.fpb.getBoard.invalidate({ projectId });
      toast.success("Column added");
      setName("");
      setColor(COLUMN_COLORS[0]);
      onClose();
    },
    onError: (e: any) => toast.error(e?.message || "Could not add the column"),
  });

  const submit = () => {
    if (!name.trim()) return;
    create.mutate({ projectId, name: name.trim(), color });
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onClose(); }}>
      <DialogContent className={`${tokens.dialog} max-w-sm`}>
        <DialogHeader>
          <DialogTitle className="font-semibold">Add Column</DialogTitle>
          <DialogDescription className={tokens.textMuted}>
            A stage in this project's workflow, or a department like Marketing or Development.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div>
            <label className={`text-xs mb-1 block ${tokens.textMuted}`}>Column Name *</label>
            <Input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
              placeholder="e.g. Marketing"
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
                    color === c ? "ring-2 ring-offset-2 ring-violet-500 ring-offset-transparent scale-110" : ""
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={onClose} className={tokens.btnGhost}>Cancel</Button>
            <Button
              onClick={submit}
              disabled={!name.trim() || create.isPending}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {create.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Adding...</>
                : "Add Column"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
