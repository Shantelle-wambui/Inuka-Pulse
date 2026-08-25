import {
  Activity,
  Bell,
  BarChart2,
  Gauge,
  History,
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
  Settings,
  FileText,
  LayoutDashboard,
  UserCircle,
  FlaskConical,
  Database,
  GitBranch,
  Trophy,
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

/**
 * Sidebar Navigation — Inuka Pulse
 *
 * Design principles:
 *   1. Each page appears EXACTLY ONCE
 *   2. Each role sees only pages relevant to their use case
 *   3. Admin sees everything
 *
 * Role → Groups visible:
 *   Programme Director → Command Center, Early Warning, Programme Operations, Workforce, (partial) Analytics & ML
 *   Case Manager       → Early Warning (alerts only), Field Operations, Programme Operations (partial)
 *   Analyst            → Early Warning, Analytics, ML Intelligence
 *   ML Admin           → ML Intelligence
 *   Coordinator        → Early Warning, Field Operations, Programme Operations, Workforce
 *   Admin              → ALL
 *   Donor              → Command Center (partial)
 */
export const sidebarItems: NavGroup[] = [

  // ── 1. COMMAND CENTER ─────────────────────────────────────────────────────
  // Strategic programme-level views for leadership and funders
  {
    id: 1,
    label: "Command Center",
    requiredRoles: ["Programme Director", "Admin", "Donor"],
    items: [
      {
        id: "director-dashboard",
        title: "Executive Dashboard",
        url: "/dashboard/director",
        icon: LayoutDashboard,
        roles: ["Programme Director", "Admin"],
      },
      {
        id: "inuka-overview",
        title: "Programme Dashboard",
        url: "/dashboard/inuka",
        icon: ShieldAlert,
        roles: ["Programme Director", "Admin"],
      },
      {
        id: "sites",
        title: "Cohort Map",
        url: "/dashboard/sites",
        icon: Map,
        roles: ["Programme Director", "Admin"],
      },
      {
        id: "programs",
        title: "Programs & Funding",
        url: "/dashboard/programs",
        icon: Building2,
      },
      {
        id: "impact",
        title: "Impact & Reach",
        url: "/dashboard/impact",
        icon: Target,
      },
      {
        id: "reports",
        title: "Reports",
        url: "/dashboard/reports",
        icon: FileText,
      },
      {
        id: "donor-portal",
        title: "Donor Dashboard",
        url: "/dashboard/donor-portal",
        icon: Heart,
        roles: ["Programme Director", "Admin", "Donor"],
      },
      {
        id: "disbursement-compliance",
        title: "Disbursement Compliance",
        url: "/dashboard/analytics/disbursement-compliance",
        icon: DollarSign,
        roles: ["Programme Director", "Admin", "Donor"],
      },
    ],
  },

  // ── 2. EARLY WARNING ──────────────────────────────────────────────────────
  // Alert triage, risk simulation, resolution tracking
  {
    id: 2,
    label: "Early Warning",
    requiredRoles: ["Programme Director", "Admin", "Case Manager", "Analyst", "Coordinator"],
    items: [
      {
        id: "ew-alerts",
        title: "Alert Queue",
        url: "/dashboard/early-warning/alerts",
        icon: Bell,
      },
      {
        id: "ew-risk-analysis",
        title: "Risk Analysis",
        url: "/dashboard/early-warning/risk-analysis",
        icon: Gauge,
        roles: ["Programme Director", "Admin", "Analyst", "Coordinator"],
      },
      {
        id: "ew-history",
        title: "Alert History",
        url: "/dashboard/early-warning/history",
        icon: History,
        roles: ["Programme Director", "Admin", "Analyst", "Coordinator"],
      },
    ],
  },

  // ── 3. FIELD OPERATIONS ───────────────────────────────────────────────────
  // Daily operational workflow for frontline staff
  {
    id: 3,
    label: "Field Operations",
    requiredRoles: ["Case Manager", "Admin", "Coordinator"],
    items: [
      {
        id: "case-manager-dashboard",
        title: "My Caseload",
        url: "/dashboard/case-manager",
        icon: UserCircle,
      },
      {
        id: "inuka-tasks",
        title: "My Visit Tasks",
        url: "/dashboard/inuka/my-tasks",
        icon: ListTodo,
      },
      {
        id: "field-visit-form",
        title: "Submit Field Visit",
        url: "/dashboard/field/visit-form",
        icon: ClipboardList,
      },
      {
        id: "nearby-alerts",
        title: "Nearby At-Risk",
        url: "/dashboard/field/nearby-alerts",
        icon: AlertTriangle,
      },
    ],
  },

  // ── 4. PROGRAMME OPERATIONS ───────────────────────────────────────────────
  // Concerns, interventions, disbursements
  {
    id: 4,
    label: "Programme Operations",
    requiredRoles: ["Programme Director", "Admin", "Case Manager", "Coordinator"],
    items: [
      {
        id: "inuka-hazards",
        title: "Welfare & Concerns",
        url: "/dashboard/inuka/hazards",
        icon: TriangleAlert,
      },
      {
        id: "inuka-capas",
        title: "Interventions",
        url: "/dashboard/inuka/capas",
        icon: ClipboardCheck,
      },
      {
        id: "ops-timeline",
        title: "Intervention Timeline",
        url: "/dashboard/operations/timeline",
        icon: Activity,
        roles: ["Programme Director", "Admin", "Coordinator"],
      },
      {
        id: "disbursements",
        title: "Disbursements",
        icon: Wrench,
        subItems: [
          {
            id: "work-orders",
            title: "Pending",
            url: "/dashboard/maintenance/work-orders",
            icon: ClipboardList,
          },
          {
            id: "maintenance-history",
            title: "Payment History",
            url: "/dashboard/maintenance/history",
            roles: ["Programme Director", "Admin", "Coordinator"],
          },
        ],
      },
    ],
  },

  // ── 5. ANALYTICS ──────────────────────────────────────────────────────────
  // Statistical analysis, trends, benchmarks — technical audience
  {
    id: 5,
    label: "Analytics",
    requiredRoles: ["Analyst", "ML Admin", "Admin"],
    items: [
      {
        id: "analytics-dashboard",
        title: "ML Analytics",
        url: "/dashboard/analytics",
        icon: BarChart2,
      },
      {
        id: "analytics-diagnostics",
        title: "Statistical Diagnostics",
        url: "/dashboard/inuka/analytics",
        icon: FlaskConical,
      },
      {
        id: "analytics-engagement",
        title: "Engagement Trends",
        url: "/dashboard/analytics/engagement-trends",
        icon: Activity,
      },
      {
        id: "analytics-cohort-journey",
        title: "Cohort Journey",
        url: "/dashboard/analytics/cohort-journey",
        icon: GitBranch,
      },
      {
        id: "analytics-benchmarking",
        title: "Benchmarking",
        url: "/dashboard/analytics/benchmarking",
        icon: Trophy,
      },
      {
        id: "inuka-roi",
        title: "Impact & ROI",
        url: "/dashboard/inuka/roi",
        icon: Calculator,
      },
    ],
  },

  // ── 6. ML / INTELLIGENCE ──────────────────────────────────────────────────
  // Model governance, drift, retraining — technical ML operations
  {
    id: 6,
    label: "ML Intelligence",
    requiredRoles: ["Analyst", "ML Admin", "Admin"],
    items: [
      {
        id: "ml-admin",
        title: "Model Governance",
        icon: BrainCircuit,
        subItems: [
          {
            id: "ml-overview",
            title: "Overview",
            url: "/dashboard/ml-admin",
          },
          {
            id: "ml-compare",
            title: "Model Compare",
            url: "/dashboard/ml-admin/compare",
            icon: FlaskConical,
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
            roles: ["ML Admin", "Admin"],
          },
          {
            id: "ml-drift",
            title: "Drift Monitor",
            url: "/dashboard/ml-admin/drift",
            icon: TrendingDown,
          },
          {
            id: "ml-retraining-schedule",
            title: "Auto Retrain",
            url: "/dashboard/ml-admin/retraining-schedule",
            icon: Timer,
            roles: ["ML Admin", "Admin"],
          },
        ],
      },
      {
        id: "allocations",
        title: "Resource Allocations",
        url: "/dashboard/allocations",
        icon: Layers,
      },
    ],
  },

  // ── 7. WORKFORCE ──────────────────────────────────────────────────────────
  // Staff management, certifications
  {
    id: 7,
    label: "Workforce",
    requiredRoles: ["Admin", "Programme Director", "Coordinator"],
    items: [
      {
        id: "technicians",
        title: "Case Managers & Officers",
        url: "/dashboard/workforce/technicians",
        icon: UserCog,
      },
      {
        id: "qualifications",
        title: "Certifications",
        url: "/dashboard/workforce/qualifications",
        icon: Award,
      },
    ],
  },

  // ── 8. ADMINISTRATION ─────────────────────────────────────────────────────
  // System config — Admin only
  {
    id: 8,
    label: "Administration",
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
      {
        id: "assignments",
        title: "Assign Case Managers",
        url: "/dashboard/admin/assignments",
        icon: UserCog,
      },
    ],
  },
];
