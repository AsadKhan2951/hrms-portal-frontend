import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Clock, Loader2, Coffee, Plus, X, Paperclip, AlertTriangle, CheckCircle2, Calendar, Timer } from "lucide-react";
import { Input } from "@/components/ui/input";
import { TodayTasks, type TodaySummary } from "@/components/TodayTasks";
import { format } from "date-fns";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TimeInOutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TimeInOutDialog({ open, onOpenChange }: TimeInOutDialogProps) {
  const [notes, setNotes] = useState("");
  const [currentTime, setCurrentTime] = useState(new Date());
  const [elapsedTime, setElapsedTime] = useState("");
  // Today's board work, as work-log lines, from <TodayTasks>.
  const [today, setToday] = useState<TodaySummary>({ doneLines: [], progressLines: [] });
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showTaskAlert, setShowTaskAlert] = useState(false);
  const [locating, setLocating] = useState(false);
  const [, setLocation] = useLocation();

  const utils = trpc.useUtils();
  const { data: activeEntry, isLoading } = trpc.timeTracking.getActive.useQuery(undefined, {
    refetchInterval: 1000, // Update every second
  });

  const { data: breakLogs } = trpc.timeTracking.getBreakLogs.useQuery(undefined, {
    enabled: !!activeEntry,
  });

  const clockInMutation = trpc.timeTracking.clockIn.useMutation({
    onSuccess: () => {
      toast.success("Clocked in successfully!");
      utils.timeTracking.getActive.invalidate();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const clockOutMutation = trpc.timeTracking.clockOut.useMutation({
    onSuccess: (data) => {
      toast.success(`Clocked out! Total hours: ${data.totalHours.toFixed(2)}`);
      utils.timeTracking.getActive.invalidate();
      utils.timeTracking.getAttendance.invalidate();
      onOpenChange(false);
      setNotes("");
      setAttachments([]);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Calculate elapsed time
  useEffect(() => {
    if (activeEntry?.timeIn) {
      const timeIn = new Date(activeEntry.timeIn);
      const now = new Date();
      const diff = now.getTime() - timeIn.getTime();
      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      setElapsedTime(`${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`);
    }
  }, [activeEntry, currentTime]);

  const handleClockIn = () => {
    if (!navigator.geolocation) {
      clockInMutation.mutate();
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        clockInMutation.mutate({
          location: {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracy: position.coords.accuracy,
            source: "gps",
          },
        });
      },
      (error) => {
        setLocating(false);
        toast.error(error.message || "Unable to fetch location. Clocking in without location.");
        clockInMutation.mutate();
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  };

  /** The work log saved with the clock-out: today's board work, then the notes. */
  const workLog = () => {
    const lines = [...today.doneLines, ...today.progressLines];
    const log = lines.join("\n");
    return notes?.trim() ? `${log}${log ? "\n\n" : ""}Notes: ${notes.trim()}` : log || undefined;
  };

  const handleClockOut = () => {
    // Nothing done or moved on the board today: ask before leaving it empty.
    if (today.doneLines.length === 0 && today.progressLines.length === 0) {
      setShowTaskAlert(true);
      return;
    }
    clockOutMutation.mutate({ notes: workLog() });
  };

  const handleForceClockOut = () => {
    setShowTaskAlert(false);
    clockOutMutation.mutate({ notes: workLog() });
  };

  const handleGoToBoard = () => {
    setShowTaskAlert(false);
    onOpenChange(false);
    setLocation("/board");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setAttachments([...attachments, ...Array.from(e.target.files)]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index));
  };

  const getTotalHours = () => {
    if (!activeEntry?.timeIn) return 0;
    const timeIn = new Date(activeEntry.timeIn);
    const now = new Date();
    return (now.getTime() - timeIn.getTime()) / (1000 * 60 * 60);
  };

  const getTotalBreakTime = () => {
    if (!breakLogs || breakLogs.length === 0) return 0;
    return breakLogs.reduce((total: number, log: any) => total + (log.duration || 0), 0);
  };

  const totalHours = getTotalHours();
  const totalBreakMinutes = getTotalBreakTime();
  const netWorkHours = totalHours - (totalBreakMinutes / 60);
  const isMinimumMet = totalHours >= 6.5;
  const isTargetMet = totalHours >= 8;

  const getTimeColor = () => {
    if (totalHours >= 8) return "text-green-500";
    if (totalHours >= 6.5) return "text-yellow-500";
    return "text-red-500";
  };

  const getRemainingHours = () => {
    if (totalHours >= 8) return 0;
    if (totalHours >= 6.5) return 8 - totalHours;
    return 6.5 - totalHours;
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>Loading...</DialogTitle>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              {activeEntry ? "Clock Out - Day Summary" : "Clock In"}
            </DialogTitle>
            <DialogDescription>
              {activeEntry
                ? "Review your work summary and clock out"
                : "Start your work day by clocking in"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="text-center">
              <div className="text-sm text-muted-foreground mb-2">Current Time</div>
              <div className="text-3xl font-bold">{format(currentTime, "HH:mm:ss")}</div>
              <div className="text-sm text-muted-foreground mt-1">
                {format(currentTime, "EEEE, MMMM d, yyyy")}
              </div>
            </div>

            {activeEntry && (
              <>
                {/* Day Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Timer className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Total Time</span>
                    </div>
                    <div className={`text-2xl font-bold ${getTimeColor()}`}>
                      {elapsedTime}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {totalHours.toFixed(2)} hours
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Coffee className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Break Time</span>
                    </div>
                    <div className="text-2xl font-bold">
                      {totalBreakMinutes} min
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {breakLogs?.length || 0} break(s) taken
                    </div>
                  </Card>

                  <Card className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Net Work</span>
                    </div>
                    <div className="text-2xl font-bold text-primary">
                      {netWorkHours.toFixed(2)}h
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Productive hours
                    </div>
                  </Card>
                </div>

                {/* Time Status */}
                {!isTargetMet && (
                  <div className="bg-muted/50 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Coffee className="h-4 w-4" />
                      <span className="font-medium text-sm">
                        {isMinimumMet ? "Target Hours Remaining" : "Minimum Hours Required"}
                      </span>
                    </div>
                    <div className={`text-2xl font-bold ${getTimeColor()}`}>
                      {getRemainingHours().toFixed(2)} hours
                    </div>
                    {!isMinimumMet && (
                      <p className="text-sm text-muted-foreground mt-2">
                        You need to work at least 6.5 hours. Target is 8 hours.
                      </p>
                    )}
                    {isMinimumMet && !isTargetMet && (
                      <p className="text-sm text-muted-foreground mt-2">
                        You've met the minimum. {getRemainingHours().toFixed(2)} hours until target.
                      </p>
                    )}
                  </div>
                )}

                {isTargetMet && (
                  <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-lg">
                    <div className="text-center">
                      <div className="text-green-500 font-semibold mb-1">
                        âœ“ Target Hours Achieved!
                      </div>
                      <p className="text-sm text-muted-foreground">
                        You can clock out now
                      </p>
                    </div>
                  </div>
                )}

                {/* Clock In/Out Times */}
                <Card className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Today's Timeline</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-muted-foreground">Clock In</div>
                      <div className="text-lg font-semibold">
                        {format(new Date(activeEntry.timeIn), "HH:mm:ss")}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">Clock Out (Expected)</div>
                      <div className="text-lg font-semibold">
                        {format(currentTime, "HH:mm:ss")}
                      </div>
                    </div>
                  </div>
                </Card>

                {/* Today's work, from the board */}
                <div className="space-y-4">
                  <Label className="text-base">Today's work</Label>
                  <TodayTasks onSummary={setToday} />

                  <div className="space-y-2">
                    <Label htmlFor="file-upload" className="cursor-pointer">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
                        <Paperclip className="h-4 w-4" />
                        Attach files (optional)
                      </div>
                    </Label>
                    <Input
                      id="file-upload"
                      type="file"
                      multiple
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    {attachments.length > 0 && (
                      <div className="space-y-1">
                        {attachments.map((file, index) => (
                          <div key={index} className="flex items-center gap-2 bg-muted/50 p-2 rounded text-sm">
                            <Paperclip className="h-3 w-3" />
                            <span className="flex-1 truncate">{file.name}</span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => removeAttachment(index)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Label htmlFor="notes">Additional Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any notes about your work day..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            {activeEntry ? (
              <Button
                onClick={handleClockOut}
                disabled={clockOutMutation.isPending}
                variant="default"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {clockOutMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Clocking Out...
                  </>
                ) : (
                  "Confirm Clock Out"
                )}
              </Button>
            ) : (
              <Button onClick={handleClockIn} disabled={clockInMutation.isPending || locating}>
                {clockInMutation.isPending || locating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {locating ? "Fetching Location..." : "Clocking In..."}
                  </>
                ) : (
                  "Clock In"
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Alert Dialog */}
      <AlertDialog open={showTaskAlert} onOpenChange={setShowTaskAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              No work logged today
            </AlertDialogTitle>
            <AlertDialogDescription>
              Nothing was finished or updated on the board today. Log what you worked on (here or on the
              board) before clocking out, or clock out anyway.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleForceClockOut}>
              Clock Out Anyway
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleGoToBoard}>
              Go to the board
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
