import {
  Bell,
  BarChart2,
  type LucideIcon,
  Map,
  ShieldAlert,
  ShieldCheck,
  Users,
  Calculator,
  TriangleAlert,
  ClipboardCheck,
  ListTodo,
  BrainCircuit,
  Wrench,
  ClipboardList,
  UserCog,
  Award,
  MapPin,
  AlertTriangle,
  TrendingDown,
  Timer,
} from "lucide-react";

export type NavBadge = "new" | "soon";

export interface NavSubItem {
  id: string;
  title: string;
  url: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
  roles?: string[];
}

interface NavItemBase {
  id: string;
  title: string;
  icon?: LucideIcon;
  badge?: NavBadge;
  disabled?: boolean;
  newTab?: boolean;
}

export interface NavMainLinkItem extends NavItemBase {
  url: string;
  subItems?: never;
  roles?: string[];
}

export interface NavMainParentItem extends NavItemBase {
  subItems: NavSubItem[];
}

export type NavMainItem = NavMainLinkItem | NavMainParentItem;

export interface NavGroup {
  id: number;
  label?: string;
  items: NavMainItem[];
  requiredRoles?: string[];
}

export const sidebarItems: NavGroup[] = [
  // ── 1. Inuka Pulse — Command Center ─────────────────────────────────────────
  {
    id: 1,
    label: "Command Center",
    items: [
      {
        id: "sentinel",
        title: "Program Overview",
        icon: ShieldAlert,
        subItems: [
          {
            id: "sentinel-overview",
            title: "Dashboard",
            url: "/dashboard/sentinel",
          },
          {
            id: "sentinel-alerts",
            title: "Alerts",
            url: "/dashboard/sentinel/alerts",
            icon: Bell,
          },
          {
            id: "sentinel-analytics",
            title: "M&E Analytics",
            url: "/dashboard/sentinel/analytics",
            icon: BarChart2,
          },
          {
            id: "sentinel-roi",
            title: "Impact & ROI",
            url: "/dashboard/sentinel/roi",
            icon: Calculator,
          },
        ],
      },
      {
        id: "sites",
        title: "Cohort Map",
        url: "/dashboard/sites",
        icon: Map,
      },
    ],
  },

  // ── 2. Program Operations ────────────────────────────────────────────────────
  {
    id: 2,
    label: "Program Operations",
    items: [
      {
        id: "hse-ops",
        title: "Beneficiary Management",
        icon: ShieldCheck,
        subItems: [
          {
            id: "sentinel-hazards",
            title: "Escalation Reports",
            url: "/dashboard/sentinel/hazards",
            icon: TriangleAlert,
            roles: ["Admin", "Program Director", "Field Officer", "Analyst", "Coordinator"],
          },
          {
            id: "sentinel-capas",
            title: "Intervention Plans",
            url: "/dashboard/sentinel/capas",
            icon: ClipboardCheck,
            roles: ["Admin", "Program Director", "Field Officer", "Analyst", "Coordinator"],
          },
        ],
      },
      {
        id: "maintenance",
        title: "Disbursements",
        icon: Wrench,
        subItems: [
          {
            id: "work-orders",
            title: "Pending Disbursements",
            url: "/dashboard/maintenance/work-orders",
            icon: ClipboardList,
            badge: "new",
          },
          {
            id: "maintenance-history",
            title: "Payment History",
            url: "/dashboard/maintenance/history",
            badge: "new",
          },
        ],
      },
      {
        id: "field-ops",
        title: "Field Operations",
        icon: MapPin,
        subItems: [
          {
            id: "sentinel-tasks",
            title: "My Visit Tasks",
            url: "/dashboard/sentinel/my-tasks",
            icon: ListTodo,
            roles: ["Field Officer"],
          },
          {
            id: "nearby-alerts",
            title: "Nearby At-Risk",
            url: "/dashboard/field/nearby-alerts",
            icon: AlertTriangle,
            badge: "new",
            roles: ["Field Officer", "Coordinator"],
          },
        ],
      },
    ],
  },

  // ── 3. Program Staff ─────────────────────────────────────────────────────────
  {
    id: 3,
    label: "Program Staff",
    requiredRoles: ["Admin", "Program Director", "Coordinator"],
    items: [
      {
        id: "technicians",
        title: "Field Officers",
        url: "/dashboard/workforce/technicians",
        icon: UserCog,
        badge: "new",
      },
      {
        id: "qualifications",
        title: "Certifications",
        url: "/dashboard/workforce/qualifications",
        icon: Award,
        badge: "new",
      },
    ],
  },

  // ── 4. Predictive Intelligence ───────────────────────────────────────────────
  {
    id: 4,
    label: "Predictive Intelligence",
    requiredRoles: ["Admin", "ML Admin", "Analyst"],
    items: [
      {
        id: "ml-admin",
        title: "Dropout Model",
        icon: BrainCircuit,
        subItems: [
          {
            id: "ml-overview",
            title: "Overview",
            url: "/dashboard/ml-admin",
          },
          {
            id: "ml-feedback",
            title: "Officer Feedback",
            url: "/dashboard/ml-admin/feedback",
          },
          {
            id: "ml-registry",
            title: "Model Registry",
            url: "/dashboard/ml-admin/registry",
          },
          {
            id: "ml-training-runs",
            title: "Training Runs",
            url: "/dashboard/ml-admin/training-runs",
          },
          {
            id: "ml-drift",
            title: "Drift Monitor",
            url: "/dashboard/ml-admin/drift",
            icon: TrendingDown,
            badge: "new",
          },
          {
            id: "ml-retraining-schedule",
            title: "Auto Retrain",
            url: "/dashboard/ml-admin/retraining-schedule",
            icon: Timer,
            badge: "new",
          },
        ],
      },
    ],
  },

  // ── 5. Accounts ──────────────────────────────────────────────────────────────
  {
    id: 5,
    label: "Accounts",
    items: [
      {
        id: "users",
        title: "Users",
        url: "/dashboard/users",
        icon: Users,
        roles: ["Admin"],
      },
      {
        id: "roles",
        title: "Roles & Permissions",
        url: "/dashboard/roles",
        icon: ShieldCheck,
        roles: ["Admin"],
      },
    ],
  },
];
