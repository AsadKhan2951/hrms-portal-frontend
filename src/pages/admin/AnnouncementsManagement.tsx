import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { NowPageHeader, Segmented } from "@/components/now/NowPage";
import { 
  Plus,
  Megaphone,
  Calendar,
  Users,
  Trash2
} from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import "./adminB.css";

export default function AnnouncementsManagement() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");

  const utils = trpc.useUtils();
  const { data: announcements = [], isLoading } = trpc.admin.getAnnouncements.useQuery();
  const createAnnouncement = trpc.admin.createAnnouncement.useMutation({
    onSuccess: async () => {
      await utils.admin.getAnnouncements.invalidate();
      toast.success("Announcement published successfully!");
      setTitle("");
      setContent("");
      setPriority("medium");
      setShowCreateDialog(false);
    },
    onError: (error) => {
      toast.error(error.message || "Failed to publish announcement");
    },
  });
  const deleteAnnouncement = trpc.admin.deleteAnnouncement.useMutation({
    onSuccess: async () => {
      await utils.admin.getAnnouncements.invalidate();
      toast.success("Announcement deleted");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete announcement");
    },
  });

  const handleCreateAnnouncement = () => {
    if (!title || !content) {
      toast.error("Please fill in all fields");
      return;
    }
    createAnnouncement.mutate({
      title,
      content,
      priority,
    });
  };

  const getPriorityPill = (priority: string) => {
    switch (priority) {
      case "high": return "now-pill risk";
      case "medium": return "now-pill nb-info-soft";
      default: return "now-pill";
    }
  };

  return (
    <AdminLayout title="Announcements Management">
      <div className="now-page">
        <NowPageHeader
          title="Announcements"
          subtitle="Create and manage announcements for all employees"
          actions={
            <button
              type="button"
              className={`now-btn sm ${showCreateDialog ? "ground" : "lime"}`}
              aria-expanded={showCreateDialog}
              onClick={() => setShowCreateDialog(!showCreateDialog)}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New Announcement
            </button>
          }
        />

        {/* Create Announcement Form */}
        {showCreateDialog && (
          <section className="now-card" aria-label="Create new announcement">
            <h2 className="now-h2 flex items-center gap-2">
              <Megaphone className="h-5 w-5" aria-hidden="true" />
              Create New Announcement
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="announcement-title" className="nb-label">Title</label>
                <Input
                  id="announcement-title"
                  placeholder="Enter announcement title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="announcement-content" className="nb-label">Content</label>
                <Textarea
                  id="announcement-content"
                  placeholder="Enter announcement content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                />
              </div>

              <div>
                <span className="nb-label">Priority</span>
                <Segmented
                  label="Priority"
                  tone="soft"
                  value={priority}
                  onChange={setPriority}
                  options={[
                    { value: "low", label: "Normal" },
                    { value: "medium", label: "Important" },
                    { value: "high", label: "Urgent" },
                  ]}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" className="now-btn sm ink" onClick={handleCreateAnnouncement}>
                  Publish Announcement
                </button>
                <button type="button" className="now-btn sm ground" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </button>
              </div>
            </div>
          </section>
        )}

        {/* Announcements List */}
        <section className="now-card flush" aria-label="Announcements">
          <div className="now-card-head pb-2">
            <h2 className="now-h2">Published</h2>
            {!isLoading && <span className="now-pill">{announcements.length}</span>}
          </div>
          {isLoading ? (
            <div className="now-row now-muted">Loading announcements...</div>
          ) : announcements.length === 0 ? (
            <div className="now-row now-muted">No announcements found</div>
          ) : (
            announcements.map((announcement: any) => (
              <article key={announcement.id} className="now-row" style={{ alignItems: "flex-start", padding: "16px 0" }}>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h3 className="now-row-title">{announcement.title}</h3>
                    <span className={getPriorityPill(announcement.priority)}>
                      {announcement.priority}
                    </span>
                  </div>
                  <p className="now-body-2 mb-2 whitespace-pre-wrap break-words">
                    {announcement.content}
                  </p>
                  <div className="now-row-sub flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" aria-hidden="true" />
                      {announcement.createdAt ? format(new Date(announcement.createdAt), "MMM dd, yyyy") : "--"}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" aria-hidden="true" />
                      {announcement.readCount ?? 0} employees read
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="now-icon-btn ground nb-bad"
                  aria-label={`Delete ${announcement.title}`}
                  title="Delete announcement"
                  onClick={() => deleteAnnouncement.mutate({ id: String(announcement.id) })}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </article>
            ))
          )}
        </section>
      </div>
    </AdminLayout>
  );
}
