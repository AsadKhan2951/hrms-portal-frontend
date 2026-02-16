import { useState } from "react";
import AdminLayout from "@/components/AdminLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { 
  Plus,
  Megaphone,
  Calendar,
  Users,
  Edit,
  Trash2
} from "lucide-react";
import { toast } from "sonner";

export default function AnnouncementsManagement() {
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [priority, setPriority] = useState<"normal" | "important" | "urgent">("normal");

  // Dummy data
  const announcements = [
    {
      id: 1,
      title: "Office Closure - Public Holiday",
      content: "The office will be closed on February 14th for the national holiday.",
      priority: "important",
      createdAt: "2026-02-10",
      author: "Aamir",
      readCount: 12
    },
    {
      id: 2,
      title: "New Project Kickoff",
      content: "We're starting a new mobile app project. All developers please attend the kickoff meeting on Monday.",
      priority: "normal",
      createdAt: "2026-02-08",
      author: "Aamir",
      readCount: 8
    },
    {
      id: 3,
      title: "Urgent: System Maintenance",
      content: "The HRMS system will undergo maintenance tonight from 10 PM to 2 AM. Please clock out before 10 PM.",
      priority: "urgent",
      createdAt: "2026-02-13",
      author: "Aamir",
      readCount: 15
    },
  ];

  const handleCreateAnnouncement = () => {
    if (!title || !content) {
      toast.error("Please fill in all fields");
      return;
    }

    toast.success("Announcement published successfully!");
    setTitle("");
    setContent("");
    setPriority("normal");
    setShowCreateDialog(false);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "destructive";
      case "important": return "default";
      default: return "secondary";
    }
  };

  return (
    <AdminLayout title="Announcements Management">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Announcements</h2>
            <p className="text-sm text-muted-foreground">
              Create and manage announcements for all employees
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(!showCreateDialog)}>
            <Plus className="h-4 w-4 mr-2" />
            New Announcement
          </Button>
        </div>

        {/* Create Announcement Form */}
        {showCreateDialog && (
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <Megaphone className="h-5 w-5" />
              Create New Announcement
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Title</label>
                <Input
                  placeholder="Enter announcement title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Content</label>
                <Textarea
                  placeholder="Enter announcement content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Priority</label>
                <div className="flex gap-2">
                  <Button
                    variant={priority === "normal" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPriority("normal")}
                  >
                    Normal
                  </Button>
                  <Button
                    variant={priority === "important" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPriority("important")}
                  >
                    Important
                  </Button>
                  <Button
                    variant={priority === "urgent" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setPriority("urgent")}
                  >
                    Urgent
                  </Button>
                </div>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleCreateAnnouncement}>
                  Publish Announcement
                </Button>
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Announcements List */}
        <div className="space-y-3">
          {announcements.map((announcement) => (
            <Card key={announcement.id} className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{announcement.title}</h3>
                    <Badge variant={getPriorityColor(announcement.priority)}>
                      {announcement.priority}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">
                    {announcement.content}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {announcement.createdAt}
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3" />
                      {announcement.readCount} employees read
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </AdminLayout>
  );
}
