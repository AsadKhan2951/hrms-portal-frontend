import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { getRealtimeSocket } from "@/lib/realtime";

export function useRealtime() {
  const utils = trpc.useUtils();

  useEffect(() => {
    const socket = getRealtimeSocket();

    const handleChat = () => {
      utils.chat.getMessages.invalidate();
    };

    const handleNotifications = () => {
      utils.notifications.getAll.invalidate();
      utils.notifications.getUnreadCount.invalidate();
    };

    const handleAnnouncements = () => {
      utils.dashboard.getAnnouncements.invalidate();
      utils.dashboard.getAnnouncementReadIds.invalidate();
      utils.admin.getAnnouncements.invalidate();
    };

    const handlePayslips = () => {
      utils.dashboard.getPayslips.invalidate();
      utils.dashboard.getPayslip.invalidate();
    };

    socket.on("chat:new", handleChat);
    socket.on("notifications:new", handleNotifications);
    socket.on("announcements:new", handleAnnouncements);
    socket.on("payslips:new", handlePayslips);

    return () => {
      socket.off("chat:new", handleChat);
      socket.off("notifications:new", handleNotifications);
      socket.off("announcements:new", handleAnnouncements);
      socket.off("payslips:new", handlePayslips);
    };
  }, [utils]);
}
