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
  Settings,
  FileText,
  LayoutDashboard,
  UserCircle,
  FlaskConical,
  Database,
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

  // ── 1. Programme Director — Executive Dashboard ───────────────────────────
  {
    id: 1,
    label: "Programme Overview",
    requiredRoles: ["Programme Director", "Admin"],
    items: [
      {
        id: "director-dashboard",
        title: "Executive Dashboard",
        url: "/dashboard/director",
        icon: LayoutDashboard,
      },
      {
        id: "inuka-overview",
        title: "Programme Intelligence",
        icon: ShieldAlert,
        subItems: [
          {
            id: "inuka-main",
            title: "Programme Dashboard",
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
      {
        id: "reports",
        title: "Reports",
        url: "/dashboard/reports",
        icon: FileText,
        badge: "new",
      },
    ],
  },

  // ── 2. Case Manager — Operational Caseload ────────────────────────────────
  {
    id: 2,
    label: "My Caseload",
    requiredRoles: ["Case Manager", "Admin"],
    items: [
      {
        id: "case-manager-dashboard",
        title: "My Dashboard",
        url: "/dashboard/case-manager",
        icon: UserCircle,
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
          },
          {
            id: "nearby-alerts",
            title: "Nearby At-Risk",
            url: "/dashboard/field/nearby-alerts",
            icon: AlertTriangle,
            badge: "new",
          },
        ],
      },
      {
        id: "beneficiary-mgmt",
        title: "Beneficiary Management",
        icon: ShieldCheck,
        subItems: [
          {
            id: "inuka-hazards",
            title: "Welfare Concerns",
            url: "/dashboard/inuka/hazards",
            icon: TriangleAlert,
          },
          {
            id: "inuka-capas",
            title: "Follow-up Actions",
            url: "/dashboard/inuka/capas",
            icon: ClipboardCheck,
          },
        ],
      },
    ],
  },

  // ── 3. Programme Operations — shared for Director + Admin ─────────────────
  {
    id: 3,
    label: "Programme Operations",
    requiredRoles: ["Programme Director", "Admin", "Coordinator"],
    items: [
      {
        id: "hse-ops",
        title: "Beneficiary Management",
        icon: ShieldCheck,
        subItems: [
          {
            id: "dir-hazards",
            title: "Welfare Concerns",
            url: "/dashboard/inuka/hazards",
            icon: TriangleAlert,
          },
          {
            id: "dir-capas",
            title: "Intervention Plans",
            url: "/dashboard/inuka/capas",
            icon: ClipboardCheck,
          },
        ],
      },
      {
        id: "disbursements",
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
    ],
  },

  // ── 4. Programme Staff — Director + Admin only ────────────────────────────
  {
    id: 4,
    label: "Programme Staff",
    requiredRoles: ["Admin", "Programme Director", "Coordinator"],
    items: [
      {
        id: "technicians",
        title: "Case Managers",
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

  // ── 5. Analyst — ML & Data Analytics ─────────────────────────────────────
  {
    id: 5,
    label: "ML & Analytics",
    requiredRoles: ["Analyst", "ML Admin", "Admin"],
    items: [
      {
        id: "analytics-dashboard",
        title: "Analytics Dashboard",
        url: "/dashboard/analytics",
        icon: BarChart2,
      },
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
        id: "analytics-data",
        title: "Data & Features",
        icon: Database,
        subItems: [
          {
            id: "analytics-survival",
            title: "Survival Curves",
            url: "/dashboard/inuka/analytics",
            icon: FlaskConical,
          },
          {
            id: "analytics-correlation",
            title: "Feature Correlation",
            url: "/dashboard/inuka/analytics",
            icon: BarChart2,
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

  // ── 6. Donor Portal ──────────────────────────────────────────────────────────
  {
    id: 6,
    label: "Donor Portal",
    requiredRoles: ["Admin", "Programme Director"],
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

  // ── 7. Accounts — Admin only ──────────────────────────────────────────────
  {
    id: 7,
    label: "Accounts",
    requiredRoles: ["Admin"],
    items: [
      {
        id: "users",
        title: "Users",
        url: "/dashboard/users",
        icon: Users,
      },
      {
        id: "roles",
        title: "Roles & Permissions",
        url: "/dashboard/roles",
        icon: ShieldCheck,
      },
      {
        id: "admin-utilities",
        title: "Admin Utilities",
        url: "/dashboard/admin",
        icon: Settings,
      },
    ],
  },
];
