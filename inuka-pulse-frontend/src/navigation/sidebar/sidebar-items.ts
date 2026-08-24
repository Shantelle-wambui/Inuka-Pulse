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
  Building2,
  Heart,
  Target,
  Layers,
  DollarSign,
  TrendingUp,
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
        id: "inuka",
        title: "Program Overview",
        icon: ShieldAlert,
        subItems: [
          {
            id: "inuka-overview",
            title: "Dashboard",
            url: "/dashboard/inuka",
          },
          {
            id: "inuka-alerts",
            title: "Alerts",
            url: "/dashboard/inuka/alerts",
            icon: Bell,
          },
          {
            id: "inuka-analytics",
            title: "M&E Analytics",
            url: "/dashboard/inuka/analytics",
            icon: BarChart2,
          },
          {
            id: "inuka-roi",
            title: "Impact & ROI",
            url: "/dashboard/inuka/roi",
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
      {
        id: "programs",
        title: "Programs & Funding",
        url: "/dashboard/programs",
        icon: Building2,
        badge: "new",
      },
      {
        id: "impact",
        title: "Impact & Reach",
        url: "/dashboard/impact",
        icon: Target,
        badge: "new",
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
            id: "inuka-hazards",
            title: "Escalation Reports",
            url: "/dashboard/inuka/hazards",
            icon: TriangleAlert,
            roles: ["Admin", "Program Director", "Field Officer", "Analyst", "Coordinator"],
          },
          {
            id: "inuka-capas",
            title: "Intervention Plans",
            url: "/dashboard/inuka/capas",
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
            id: "inuka-tasks",
            title: "My Visit Tasks",
            url: "/dashboard/inuka/my-tasks",
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
      {
        id: "allocations",
        title: "Resource Allocations",
        url: "/dashboard/allocations",
        icon: Layers,
        badge: "new",
      },
    ],
  },

  // ── 5. Donor Portal ──────────────────────────────────────────────────────────
  {
    id: 5,
    label: "Donor Portal",
    requiredRoles: ["Admin", "Program Director", "Donor"],
    items: [
      {
        id: "donor-portal",
        title: "Donor Dashboard",
        url: "/dashboard/donor-portal",
        icon: Heart,
        badge: "new",
      },
    ],
  },

  // ── 6. Accounts ──────────────────────────────────────────────────────────────
  {
    id: 6,
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
