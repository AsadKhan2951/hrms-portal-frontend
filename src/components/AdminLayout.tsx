import type { ReactNode } from "react";
import { Redirect } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
import { isAnyHead } from "@/lib/roles";
import LayoutWrapper from "./LayoutWrapper";

interface AdminLayoutProps {
  children: ReactNode;
  title?: string;
}

/**
 * Pages for heads and above (team, leaves, requests, payslips...). They open
 * in the same shell as everything else: the admin sidebar for admins and heads
 * of operations, the employee sidebar with the head's extra items for a
 * department head. Plain employees are sent home.
 */
export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user } = useAuth();
  if (user && !isAnyHead(user.role)) {
    return <Redirect to="/dashboard" />;
  }
  return <LayoutWrapper>{children}</LayoutWrapper>;
}
