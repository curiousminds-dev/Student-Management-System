import type { PermissionKey } from "@/types";
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  ClipboardList,
  Eye,
  Gavel,
  HeartPulse,
  GraduationCap,
  FileBarChart,
  MessageSquare,
  UserCog,
  Tablet,
  ScrollText,
  Settings,
  ScanLine,
} from "lucide-react";
import type { ComponentType } from "react";

export interface NavItem {
  label: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
  permission: PermissionKey;
  alt?: PermissionKey;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const NAVIGATION: NavSection[] = [
  {
    title: "Overview",
    items: [{ label: "Dashboard", to: "/", icon: LayoutDashboard, permission: "dashboard.view" }],
  },
  {
    title: "Learner management",
    items: [
      {
        label: "Learners",
        to: "/learners",
        icon: Users,
        permission: "learners.view",
        alt: "learners.identity_only",
      },
      {
        label: "Attendance",
        to: "/attendance",
        icon: CalendarCheck,
        permission: "attendance.view",
      },
      { label: "Occasions", to: "/occasions", icon: ClipboardList, permission: "attendance.view" },
      { label: "Scanning", to: "/scan", icon: ScanLine, permission: "attendance.record" },
    ],
  },
  {
    title: "Learner support",
    items: [
      {
        label: "Observations",
        to: "/observations",
        icon: Eye,
        permission: "observations.view",
        alt: "observations.create",
      },
      { label: "Cases", to: "/cases", icon: Gavel, permission: "cases.view" },
      { label: "Welfare", to: "/welfare", icon: HeartPulse, permission: "welfare.view" },
      { label: "Academics", to: "/academics", icon: GraduationCap, permission: "academics.view" },
    ],
  },
  {
    title: "Administration",
    items: [
      { label: "Reports", to: "/reports", icon: FileBarChart, permission: "reports.view" },
      {
        label: "Communication",
        to: "/communication",
        icon: MessageSquare,
        permission: "communication.view",
      },
      { label: "Staff and roles", to: "/staff", icon: UserCog, permission: "staff.manage" },
      { label: "Devices", to: "/devices", icon: Tablet, permission: "devices.view" },
      { label: "Audit logs", to: "/audit", icon: ScrollText, permission: "audit.view" },
      { label: "School settings", to: "/settings", icon: Settings, permission: "settings.manage" },
    ],
  },
];
