import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../src/stores/authStore";
import { getCaseloadSummary, getAlerts, getMyCapas } from "../../src/api/client";
import type { CaseloadSummary, Alert, Capa } from "../../src/api/client";
import { Colors } from "../../src/constants";

export default function HomeScreen() {
  const router = useRouter();
  const { user, logout } = useAuthStore();

  const [summary, setSummary] = useState<CaseloadSummary | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [tasks, setTasks] = useState<Capa[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const firstName = user?.name?.split(" ")[0] ?? "there";

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [s, a, t] = await Promise.all([
        getCaseloadSummary(),
        getAlerts(),
        getMyCapas(),
      ]);
      setSummary(s);
      // Only show active/critical alerts
      setAlerts(a.filter((al) => al.status === "active").slice(0, 3));
      setTasks(t.filter((c) => ["open", "in_progress"].includes(c.status)).slice(0, 3));
    } catch (e: unknown) {
      setError("Could not load data. Check your connection.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading your dashboard…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Greeting */}
        <View style={styles.greeting}>
          <View>
            <Text style={styles.greetingText}>
              {getGreeting()}, {firstName} 👋
            </Text>
            <Text style={styles.greetingSubtext}>
              {new Date().toLocaleDateString("en-KE", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </Text>
          </View>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Ionicons name="log-out-outline" size={22} color={Colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Error banner */}
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="warning-outline" size={16} color="#991B1B" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        {/* Caseload KPI strip */}
        <Text style={styles.sectionTitle}>Your Caseload</Text>
        <View style={styles.kpiRow}>
          <KpiCard
            label="Total"
            value={summary?.total ?? 0}
            color={Colors.primary}
            icon="people-outline"
          />
          <KpiCard
            label="Needs Action"
            value={summary?.needsAttention ?? 0}
            color={Colors.accent}
            icon="alert-circle-outline"
          />
          <KpiCard
            label="At-Risk"
            value={summary?.atRisk ?? 0}
            color={Colors.riskAtRisk}
            icon="trending-down-outline"
          />
          <KpiCard
            label="Active"
            value={summary?.active ?? 0}
            color={Colors.riskActive}
            icon="checkmark-circle-outline"
          />
        </View>

        {/* Quick actions */}
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsRow}>
          <ActionButton
            label="My Caseload"
            icon="people"
            color={Colors.primary}
            onPress={() => router.push("/(app)/caseload")}
          />
          <ActionButton
            label="Submit Visit"
            icon="clipboard"
            color={Colors.accent}
            onPress={() => router.push({ pathname: "/(app)/visit/[beneficiaryId]", params: { beneficiaryId: "select" } })}
          />
        </View>

        {/* Active alerts */}
        {alerts.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Active Alerts</Text>
            {alerts.map((alert) => (
              <AlertRow key={alert.id} alert={alert} />
            ))}
          </>
        )}

        {/* My tasks */}
        {tasks.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>My Open Tasks</Text>
            {tasks.map((task) => (
              <TaskRow key={task.id} task={task} />
            ))}
          </>
        )}

        {/* Sync status */}
        {summary?.lastUpdated && (
          <Text style={styles.syncText}>
            Last updated: {summary.lastUpdated}
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  color,
  icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
}) {
  return (
    <View style={[styles.kpiCard, { borderTopColor: color }]}>
      <Ionicons name={icon} size={18} color={color} />
      <Text style={[styles.kpiValue, { color }]}>{value}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
    </View>
  );
}

function ActionButton({
  label,
  icon,
  color,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.actionBtn, { backgroundColor: color }]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      <Ionicons name={icon} size={24} color="#fff" />
      <Text style={styles.actionLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  const sevColor =
    alert.severity === "critical"
      ? Colors.accent
      : alert.severity === "high"
      ? Colors.riskDisengaged
      : Colors.riskAtRisk;

  return (
    <View style={styles.listRow}>
      <View style={[styles.sevDot, { backgroundColor: sevColor }]} />
      <View style={styles.listRowContent}>
        <Text style={styles.listRowTitle} numberOfLines={1}>
          {alert.title}
        </Text>
        <Text style={styles.listRowSub}>{alert.siteName}</Text>
      </View>
      <Text style={[styles.sevBadge, { color: sevColor }]}>
        {alert.severity}
      </Text>
    </View>
  );
}

function TaskRow({ task }: { task: Capa }) {
  return (
    <View style={styles.listRow}>
      <Ionicons name="checkbox-outline" size={20} color={Colors.primary} />
      <View style={[styles.listRowContent, { marginLeft: 10 }]}>
        <Text style={styles.listRowTitle} numberOfLines={2}>
          {task.description}
        </Text>
        <Text style={styles.listRowSub}>Due: {task.dueDate ?? "—"}</Text>
      </View>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },

  greeting: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  greetingText: { fontSize: 22, fontWeight: "700", color: Colors.text },
  greetingSubtext: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  logoutBtn: { padding: 8 },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: "#991B1B", fontSize: 13, flex: 1 },

  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 20,
  },

  // KPI strip
  kpiRow: { flexDirection: "row", gap: 8 },
  kpiCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    gap: 4,
    borderTopWidth: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  kpiValue: { fontSize: 22, fontWeight: "800" },
  kpiLabel: { fontSize: 10, color: Colors.textSecondary, textAlign: "center" },

  // Action buttons
  actionsRow: { flexDirection: "row", gap: 12 },
  actionBtn: {
    flex: 1,
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    gap: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  actionLabel: { color: "#fff", fontSize: 13, fontWeight: "700" },

  // List rows (alerts + tasks)
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  sevDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  listRowContent: { flex: 1 },
  listRowTitle: { fontSize: 14, fontWeight: "600", color: Colors.text },
  listRowSub: { fontSize: 12, color: Colors.textSecondary, marginTop: 2 },
  sevBadge: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },

  syncText: {
    textAlign: "center",
    color: Colors.textMuted,
    fontSize: 11,
    marginTop: 24,
  },
});
