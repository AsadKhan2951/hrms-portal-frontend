import { useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Textarea } from "../components/ui/textarea";
import { Label } from "../components/ui/label";
import { trpc } from "../lib/trpc";
import { toast } from "sonner";
import { Calendar, Clock, Users, MapPin, Link as LinkIcon, Video, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useLocation } from "wouter";

export default function ScheduleMeeting() {
  const [, setLocation] = useLocation();
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    agenda: "",
    startTime: "",
    endTime: "",
    location: "",
    meetingLink: "",
    participantIds: [] as number[],
  });

  const { data: upcomingMeetings, isLoading } = trpc.meetings.getMyMeetings.useQuery();
  const createMeeting = trpc.meetings.create.useMutation({
    onSuccess: () => {
      toast.success("Meeting scheduled successfully!");
      setFormData({
        title: "",
        description: "",
        agenda: "",
        startTime: "",
        endTime: "",
        location: "",
        meetingLink: "",
        participantIds: [],
      });
    },
    onError: (error) => {
      toast.error("Failed to schedule meeting: " + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title || !formData.startTime || !formData.endTime) {
      toast.error("Please fill in all required fields");
      return;
    }

    createMeeting.mutate({
      title: formData.title,
      description: formData.description,
      agenda: formData.agenda,
      startTime: new Date(formData.startTime),
      endTime: new Date(formData.endTime),
      location: formData.location,
      meetingLink: formData.meetingLink,
      participantIds: formData.participantIds,
    });
  };

  const futureMeetings = upcomingMeetings?.filter((meeting: any) => {
    return new Date(meeting.startTime) > new Date();
  }).sort((a: any, b: any) => {
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  }) || [];

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Schedule Meeting</h1>
          <p className="text-muted-foreground">Create and manage your meetings</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Meeting Form */}
          <Card className="lg:col-span-2 p-6">
            <h2 className="text-xl font-semibold mb-4">New Meeting</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="title">Meeting Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Weekly Team Sync"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="startTime">Start Time *</Label>
                  <Input
                    id="startTime"
                    type="datetime-local"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="endTime">End Time *</Label>
                  <Input
                    id="endTime"
                    type="datetime-local"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the meeting"
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="agenda">Agenda</Label>
                <Textarea
                  id="agenda"
                  value={formData.agenda}
                  onChange={(e) => setFormData({ ...formData, agenda: e.target.value })}
                  placeholder="Meeting agenda and discussion points"
                  rows={4}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="location">Location</Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="Office, Room 301"
                      className="pl-10"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="meetingLink">Meeting Link</Label>
                  <div className="relative">
                    <Video className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="meetingLink"
                      value={formData.meetingLink}
                      onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
                      placeholder="https://meet.google.com/..."
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setLocation("/calendar")}>
                  Cancel
                </Button>
                <Button type="submit" disabled={createMeeting.isPending}>
                  {createMeeting.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Scheduling...
                    </>
                  ) : (
                    "Schedule Meeting"
                  )}
                </Button>
              </div>
            </form>
          </Card>

          {/* Upcoming Meetings */}
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">Upcoming Meetings</h2>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : futureMeetings.length > 0 ? (
              <div className="space-y-3">
                {futureMeetings.slice(0, 5).map((meeting: any) => (
                  <div
                    key={meeting.id}
                    className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                    onClick={() => setLocation("/calendar")}
                  >
                    <h3 className="font-medium text-sm mb-1">{meeting.title}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{format(new Date(meeting.startTime), "MMM dd, HH:mm")}</span>
                    </div>
                    {meeting.location && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3" />
                        <span>{meeting.location}</span>
                      </div>
                    )}
                  </div>
                ))}
                {futureMeetings.length > 5 && (
                  <Button variant="ghost" size="sm" className="w-full" onClick={() => setLocation("/calendar")}>
                    View All ({futureMeetings.length} meetings)
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No upcoming meetings</p>
              </div>
            )}
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
