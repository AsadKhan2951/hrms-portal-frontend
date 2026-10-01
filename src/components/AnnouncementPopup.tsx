import { useMemo, useState } from "react";
import { Megaphone } from "lucide-react";

import { trpc } from "@/lib/trpc";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Announcements older than this are never popped up - only shown on the
// Announcements page - so a backlog of unread items can't flood someone on login.
const POPUP_WINDOW_DAYS = 21;

/**
 * Shows unread, recent announcements as a modal the first time a person lands on
 * any page after one is posted. Dismissing marks them read (server-side), so it
 * appears once per announcement, for every employee and department head alike.
 * Mounted in both the employee and admin layouts.
 */
export function AnnouncementPopup() {
  const utils = trpc.useUtils();
  const { data: announcements = [] } = trpc.dashboard.getAnnouncements.useQuery();
  const { data: readIds = [] } = trpc.dashboard.getAnnouncementReadIds.useQuery();
  const markRead = trpc.dashboard.markAnnouncementRead.useMutation();
  const [dismissed, setDismissed] = useState(false);

  const unread = useMemo(() => {
    const read = new Set((readIds as any[]).filter(Boolean).map(String));
    const cutoff = Date.now() - POPUP_WINDOW_DAYS * 24 * 60 * 60 * 1000;
    return (announcements as any[])
      .filter(a => a && !read.has(String(a.id)))
      .filter(a => {
        const t = new Date(a.createdAt).getTime();
        return Number.isNaN(t) || t >= cutoff;
      });
  }, [announcements, readIds]);

  const open = !dismissed && unread.length > 0;

  const acknowledge = () => {
    setDismissed(true);
    // Fire-and-forget per announcement; the list refreshes once they land.
    Promise.allSettled(
      unread.map(a => markRead.mutateAsync({ announcementId: String(a.id) }))
    ).then(() => utils.dashboard.getAnnouncementReadIds.invalidate());
  };

  const priorityTone = (p?: string) =>
    p === "high"
      ? "bg-red-500/10 text-red-500"
      : p === "low"
        ? "bg-gray-500/10 text-gray-500"
        : "bg-blue-500/10 text-blue-500";

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) acknowledge(); }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            {unread.length > 1 ? `${unread.length} New Announcements` : "New Announcement"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {unread.map(a => (
            <div key={a.id} className="rounded-lg border p-4">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <h3 className="font-semibold text-sm">{a.title}</h3>
                {a.priority && (
                  <Badge variant="outline" className={`capitalize text-[10px] ${priorityTone(a.priority)}`}>
                    {a.priority}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.content}</p>
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button onClick={acknowledge} className="w-full sm:w-auto">Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
