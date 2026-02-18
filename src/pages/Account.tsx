import { useAuth } from "@/_core/hooks/useAuth";
import LayoutWrapper from "@/components/LayoutWrapper";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  User,
  Mail,
  Phone,
  MapPin,
  CreditCard,
  Briefcase,
  Calendar,
  Loader2,
  Check,
} from "lucide-react";
import { format } from "date-fns";
import { SUPERHERO_AVATARS, getAvatarById } from "@shared/avatars";
import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";

export default function Account() {
  const { user, loading } = useAuth();
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || "ironman");
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  
  const updateAvatarMutation = trpc.auth.updateAvatar.useMutation({
    onSuccess: () => {
      toast.success("Avatar updated successfully!");
      window.location.reload(); // Refresh to update avatar everywhere
    },
    onError: () => {
      toast.error("Failed to update avatar");
    },
  });

  const changePasswordMutation = trpc.auth.changePassword.useMutation({
    onSuccess: () => {
      toast.success("Password updated successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update password");
    },
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  // Extended profile data
  const profileData = {
    name: user.name || "Employee",
    email: user.email || "employee@rad.com",
    phone: "+92 300 1234567",
    address: "123 Main Street, Karachi, Pakistan",
    cnic: "42101-1234567-1",
    designation: user.position || "Software Developer",
    department: user.department || "Engineering",
    employeeId: user.employeeId || "EMP001",
    joinDate: user.createdAt ? new Date(user.createdAt) : new Date(),
  };

  const personalInfo = [
    { icon: User, label: "Full Name", value: profileData.name },
    { icon: Mail, label: "Email Address", value: profileData.email },
    { icon: Phone, label: "Phone Number", value: profileData.phone },
    { icon: CreditCard, label: "CNIC Number", value: profileData.cnic },
    { icon: MapPin, label: "Address", value: profileData.address },
  ];

  const employmentInfo = [
    { icon: Briefcase, label: "Designation", value: profileData.designation },
    { icon: Briefcase, label: "Department", value: profileData.department },
    { icon: CreditCard, label: "Employee ID", value: profileData.employeeId },
    { icon: Calendar, label: "Date of Joining", value: format(profileData.joinDate, "MMMM dd, yyyy") },
  ];

  return (
    <LayoutWrapper>
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-3xl space-y-6">
          {/* Header */}
          <div className="text-center space-y-3">
            {user.avatar && user.avatar.startsWith("http") ? (
              <img
                src={user.avatar}
                alt="Avatar"
                className="h-20 w-20 mx-auto rounded-full object-cover ring-2 ring-border"
              />
            ) : (
              <div 
                className="h-20 w-20 mx-auto rounded-full flex items-center justify-center text-4xl"
                style={{ backgroundColor: getAvatarById(user.avatar).color + "20" }}
              >
                {getAvatarById(user.avatar).emoji}
              </div>
            )}
            <div>
              <div className="flex items-center justify-center gap-2 mb-1">
                <h1 className="text-2xl font-bold">{profileData.name}</h1>
                <Badge variant="default">{user.role}</Badge>
              </div>
              <p className="text-muted-foreground">{profileData.designation}</p>
            </div>
          </div>

          {/* Avatar Selection */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Choose Your Avatar</h2>
              <p className="text-sm text-muted-foreground">Scroll to explore</p>
            </div>
            
            {/* Horizontal Scrollable Carousel */}
            <div className="relative mb-6">
              <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent hover:scrollbar-thumb-primary/40">
                {SUPERHERO_AVATARS.map((avatar) => (
                  <button
                    key={avatar.id}
                    onClick={() => setSelectedAvatar(avatar.id)}
                    className={`relative flex-shrink-0 w-20 h-20 rounded-full flex items-center justify-center text-3xl transition-all hover:scale-110 ${
                      selectedAvatar === avatar.id
                        ? "ring-4 ring-primary shadow-xl scale-110"
                        : "ring-2 ring-border hover:ring-primary/50"
                    }`}
                    style={{ backgroundColor: avatar.color + "20" }}
                    title={avatar.name}
                  >
                    {avatar.emoji}
                    {selectedAvatar === avatar.id && (
                      <div className="absolute -top-1 -right-1 bg-primary text-primary-foreground rounded-full p-1">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Upload Custom Picture */}
            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Or upload your own picture</label>
              <div className="flex gap-2">
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  id="avatar-upload"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    // Validate file size (2MB max)
                    if (file.size > 2 * 1024 * 1024) {
                      toast.error("File size must be less than 2MB");
                      return;
                    }

                    // Validate file type
                    if (!file.type.startsWith("image/")) {
                      toast.error("Please upload an image file");
                      return;
                    }

                    setUploadedFile(file);
                    
                    // Create preview
                    const reader = new FileReader();
                    reader.onloadend = () => {
                      setUploadPreview(reader.result as string);
                    };
                    reader.readAsDataURL(file);

                    // Upload to S3
                    setIsUploading(true);
                    try {
                      const formData = new FormData();
                      formData.append("file", file);

                      const response = await fetch("/api/upload-avatar", {
                        method: "POST",
                        body: formData,
                      });

                      if (!response.ok) throw new Error("Upload failed");

                      const { url } = await response.json();
                      setSelectedAvatar(url);
                      toast.success("Image uploaded successfully!");
                    } catch (error) {
                      toast.error("Failed to upload image");
                      console.error(error);
                    } finally {
                      setIsUploading(false);
                    }
                  }}
                />
                <label
                  htmlFor="avatar-upload"
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span className="text-sm">Uploading...</span>
                    </>
                  ) : uploadPreview ? (
                    <>
                      <img src={uploadPreview} alt="Preview" className="h-8 w-8 rounded-full object-cover" />
                      <span className="text-sm">Change Image</span>
                    </>
                  ) : (
                    <>
                      <User className="h-5 w-5" />
                      <span className="text-sm">Choose Image</span>
                    </>
                  )}
                </label>
              </div>
              <p className="text-xs text-muted-foreground mt-2">Max file size: 2MB. Supported: JPG, PNG, GIF</p>
            </div>

            <Button
              onClick={() => updateAvatarMutation.mutate({ avatar: selectedAvatar })}
              disabled={updateAvatarMutation.isPending || selectedAvatar === user.avatar}
              className="w-full"
            >
              {updateAvatarMutation.isPending ? "Saving..." : "Save Avatar"}
            </Button>
          </Card>

          {/* Personal Information */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Personal Information</h2>
            <div className="space-y-4">
              {personalInfo.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div
                    key={index}
                    className="flex items-center gap-4 pb-4 border-b last:border-0 last:pb-0"
                  >
                    <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground mb-0.5">
                        {item.label}
                      </div>
                      <div className="font-medium text-sm truncate">{item.value}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Employment Information */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Employment Information</h2>
            <div className="space-y-4">
              {employmentInfo.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div
                    key={index}
                    className="flex items-center gap-4 pb-4 border-b last:border-0 last:pb-0"
                  >
                    <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-muted-foreground mb-0.5">
                        {item.label}
                      </div>
                      <div className="font-medium text-sm truncate">{item.value}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Change Password */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold mb-4">Change Password</h2>
            <div className="space-y-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Current Password</label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">New Password</label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Confirm New Password</label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                />
              </div>
              <Button
                className="w-full"
                disabled={changePasswordMutation.isPending}
                onClick={() => {
                  if (!currentPassword || !newPassword || !confirmPassword) {
                    toast.error("Please fill all password fields");
                    return;
                  }
                  if (newPassword.length < 6) {
                    toast.error("New password must be at least 6 characters");
                    return;
                  }
                  if (newPassword !== confirmPassword) {
                    toast.error("New password and confirmation do not match");
                    return;
                  }
                  changePasswordMutation.mutate({
                    currentPassword,
                    newPassword,
                  });
                }}
              >
                {changePasswordMutation.isPending ? "Updating..." : "Update Password"}
              </Button>
            </div>
          </Card>

          {/* Note */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              To update your account information, please contact HR department
            </p>
          </div>
        </div>
      </div>
    </LayoutWrapper>
  );
}
