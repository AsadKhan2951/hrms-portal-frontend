import { useEffect, useState } from "react";
import { Link } from "wouter";
import { differenceInMonths, format } from "date-fns";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { SUPERHERO_AVATARS } from "@shared/avatars";
import { useAuth } from "@/_core/hooks/useAuth";
import AvatarFace from "@/components/now/AvatarFace";
import NowPage, { NowSwitch, Segmented } from "@/components/now/NowPage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTheme, type ThemeMode } from "@/contexts/ThemeContext";
import { apiUrl } from "@/lib/api";
import { trpc } from "@/lib/trpc";

const WINGMAN_PREFS = [
  { key: "askBeforeSending", name: "Ask before sending anything", desc: "Leave and tickets wait for your OK before they go to HR" },
  { key: "morningBrief", name: "Morning brief on Home", desc: "Tasks, meetings and anything that needs fixing, at the top of Home" },
  { key: "clockOutReminder", name: "Clock-out reminder", desc: "A nudge at 19:00 if the portal is open and you are still clocked in" },
] as const;

/** My account: who you are in the portal, how Wingman behaves, and sign-in settings. */
export default function Account() {
  const { user, loading, logout } = useAuth();
  const utils = trpc.useUtils();
  const { mode, setMode } = useTheme();
  const { data: projectStats } = trpc.projects.getStats.useQuery();
  const settings = trpc.wingman.getSettings.useQuery();

  const [photoOpen, setPhotoOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (photoOpen) setSelectedAvatar(user?.avatar || "");
  }, [photoOpen, user?.avatar]);

  const updateAvatar = trpc.auth.updateAvatar.useMutation({
    onSuccess: async () => {
      toast.success("Photo updated");
      setPhotoOpen(false);
      await utils.auth.me.invalidate();
    },
    onError: () => toast.error("Could not update your photo"),
  });

  const changePassword = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Password changed");
      setPasswordOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error: any) => toast.error(error.message || "Could not change your password"),
  });

  const updateSettings = trpc.wingman.updateSettings.useMutation({
    // Shown as switched straight away, and put back if the save fails.
    onMutate: async (change: Record<string, boolean>) => {
      await utils.wingman.getSettings.cancel();
      const previous = utils.wingman.getSettings.getData();
      utils.wingman.getSettings.setData(undefined, (old: any) => ({ ...old, ...change }));
      return { previous };
    },
    onError: (_error: unknown, _change: unknown, context: any) => {
      utils.wingman.getSettings.setData(undefined, context?.previous);
      toast.error("Could not save that setting");
    },
    onSettled: () => {
      utils.wingman.getSettings.invalidate();
      utils.wingman.getOverview.invalidate();
    },
  });

  if (loading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }
  if (!user) return null;

  const joined = user.createdAt ? new Date(user.createdAt) : null;
  const months = joined ? Math.max(0, differenceInMonths(new Date(), joined)) : 0;
  const tenure =
    months >= 12
      ? `${Math.floor(months / 12)} ${Math.floor(months / 12) === 1 ? "year" : "years"}${months % 12 ? `, ${months % 12} mo` : ""}`
      : `${months} ${months === 1 ? "month" : "months"}`;
  const nextMilestone = Math.floor(months / 12) + 1;

  const uploadPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return toast.error("Choose an image file");
    if (file.size > 2 * 1024 * 1024) return toast.error("The image must be under 2 MB");
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch(apiUrl("/api/upload-avatar"), { method: "POST", body: formData, credentials: "include" });
      if (!response.ok) throw new Error("Upload failed");
      const { url } = await response.json();
      setSelectedAvatar(url);
    } catch {
      toast.error("Could not upload the image");
    } finally {
      setIsUploading(false);
    }
  };

  const signOut = async () => {
    try {
      await logout();
      window.location.href = "/";
    } catch (error: any) {
      toast.error(error?.message || "Clock out before you sign out");
    }
  };

  const info = (label: string, value: string | null | undefined) => (
    <div className="now-row">
      <span className="now-muted">{label}</span>
      <span style={{ fontWeight: 600, textAlign: "right", overflowWrap: "anywhere" }}>{value || "Not set"}</span>
    </div>
  );

  return (
    <NowPage
      title={user.name || "My account"}
      subtitle={[user.position, user.department, user.employeeId].filter(Boolean).join(" · ") || "Your account"}
      lead={<AvatarFace avatar={user.avatar} name={user.name} size={72} fontSize={26} />}
      actions={
        <button type="button" className="now-btn white md" onClick={() => setPhotoOpen(true)}>
          Change photo
        </button>
      }
    >
      <div className="now-cols">
        <div className="now-col-main">
          <section className="now-card flush">
            <div className="now-card-head" style={{ marginBottom: 8, flexWrap: "wrap" }}>
              <h2 className="now-h2">Personal</h2>
              <span className="now-small now-muted">
                HR updates these.{" "}
                <Link href="/requests?new=ticket" className="now-link" style={{ fontSize: 13 }}>
                  Request a change
                </Link>
              </span>
            </div>
            {info("Full name", user.name)}
            {info("Work email", user.email)}
            {info("Employee ID", user.employeeId)}
            {info("Designation", user.position)}
            {info("Department", user.department)}
            {info("Joined", joined ? format(joined, "d MMMM yyyy") : null)}
          </section>

          <section className="now-card flush">
            <h2 className="now-h2" style={{ marginBottom: 8 }}>
              Wingman settings
            </h2>
            {WINGMAN_PREFS.map(pref => (
              <div key={pref.key} className="now-row" style={{ padding: "12px 0" }}>
                <div style={{ minWidth: 0 }}>
                  <div className="now-row-title">{pref.name}</div>
                  <div className="now-row-sub">{pref.desc}</div>
                </div>
                <NowSwitch
                  label={pref.name}
                  checked={Boolean(settings.data?.[pref.key])}
                  disabled={!settings.data}
                  onChange={next => updateSettings.mutate({ [pref.key]: next })}
                />
              </div>
            ))}
            {settings.isError && <div className="now-row now-warn">Could not load your Wingman settings.</div>}
          </section>
        </div>

        <div className="now-col-side">
          <section className="now-card">
            <h2 className="now-h2">Growth</h2>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span className="now-muted">Tenure</span>
                <span style={{ fontWeight: 600, textAlign: "right" }}>{joined ? tenure : "Not set"}</span>
              </div>
              <div className="now-bar" style={{ marginTop: 8 }}>
                <span style={{ width: `${joined ? Math.round(((months % 12) / 12) * 100) : 0}%` }} />
              </div>
              {joined && (
                <div className="now-small now-muted" style={{ marginTop: 6 }}>
                  Next milestone: {nextMilestone} {nextMilestone === 1 ? "year" : "years"}
                </div>
              )}
            </div>
            <div style={{ display: "flex", gap: 32, paddingTop: 14, borderTop: "1px solid var(--secondary)" }}>
              <div>
                <div className="now-big-num">{projectStats?.activeProjects ?? 0}</div>
                <div className="now-small now-muted" style={{ marginTop: 4 }}>
                  Active projects
                </div>
              </div>
              <div>
                <div className="now-big-num">{projectStats?.completedTasks ?? 0}</div>
                <div className="now-small now-muted" style={{ marginTop: 4 }}>
                  Tasks completed
                </div>
              </div>
            </div>
          </section>

          <section className="now-card" style={{ gap: 12 }}>
            <h2 className="now-h2">Appearance</h2>
            <div style={{ display: "flex" }}>
              <Segmented<ThemeMode>
                label="Appearance"
                tone="soft"
                value={mode}
                onChange={next => setMode?.(next)}
                options={[
                  { value: "light", label: "Light" },
                  { value: "dark", label: "Dark" },
                  { value: "system", label: "System" },
                ]}
              />
            </div>
          </section>

          <section className="now-card" style={{ gap: 12 }}>
            <h2 className="now-h2">Security</h2>
            <div className="now-body-2">
              {user.twoFactorEnabled ? "Two-step sign-in is on for your account." : "You sign in with your employee ID and password."}
            </div>
            <button type="button" className="now-btn ground md" onClick={() => setPasswordOpen(true)}>
              Change password
            </button>
            <button type="button" className="now-btn warn-text md" onClick={signOut}>
              Sign out
            </button>
          </section>
        </div>
      </div>

      <Dialog open={photoOpen} onOpenChange={setPhotoOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Change photo</DialogTitle>
            <DialogDescription>Pick an avatar or upload your own picture.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="flex justify-center">
              <AvatarFace avatar={selectedAvatar} name={user.name} size={88} fontSize={30} />
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {SUPERHERO_AVATARS.map(avatar => (
                <button
                  key={avatar.id}
                  type="button"
                  title={avatar.name}
                  aria-label={avatar.name}
                  aria-pressed={selectedAvatar === avatar.id}
                  onClick={() => setSelectedAvatar(avatar.id)}
                  className="relative flex h-14 w-14 items-center justify-center rounded-full text-2xl"
                  style={{
                    backgroundColor: `${avatar.color}33`,
                    boxShadow: selectedAvatar === avatar.id ? "0 0 0 3px var(--primary)" : "0 0 0 1.5px var(--border)",
                  }}
                >
                  {avatar.emoji}
                  {selectedAvatar === avatar.id && (
                    <span className="absolute -right-1 -top-1 rounded-full bg-primary p-1 text-primary-foreground">
                      <Check className="h-3 w-3" />
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div>
              <input
                id="avatar-upload"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={event => {
                  void uploadPhoto(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              <label htmlFor="avatar-upload" className="now-btn ground md" style={{ width: "100%", cursor: "pointer" }}>
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Uploading...
                  </>
                ) : (
                  "Upload a picture"
                )}
              </label>
              <p className="mt-2 text-xs text-muted-foreground">JPG, PNG or GIF, up to 2 MB.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPhotoOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={updateAvatar.isPending || isUploading || !selectedAvatar || selectedAvatar === user.avatar}
                onClick={() => updateAvatar.mutate({ avatar: selectedAvatar })}
              >
                {updateAvatar.isPending ? "Saving..." : "Save photo"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change password</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4 py-2"
            onSubmit={event => {
              event.preventDefault();
              if (!currentPassword || !newPassword || !confirmPassword) return toast.error("Fill in all three fields");
              if (newPassword !== confirmPassword) return toast.error("The new passwords do not match");
              if (newPassword.length < 6) return toast.error("Use at least 6 characters");
              changePassword.mutate({ currentPassword, newPassword });
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="pw-current">Current password</Label>
              <Input id="pw-current" type="password" autoComplete="current-password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-new">New password</Label>
              <Input id="pw-new" type="password" autoComplete="new-password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pw-confirm">New password again</Label>
              <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setPasswordOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={changePassword.isPending}>
                {changePassword.isPending ? "Saving..." : "Change password"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </NowPage>
  );
}
