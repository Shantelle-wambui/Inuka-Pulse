import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from "react-native";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getMyCaseload } from "../../src/api/client";
import type { Beneficiary } from "../../src/api/client";
import { Colors } from "../../src/constants";

// ── Risk band styling ─────────────────────────────────────────────────────────

const BAND_STYLES: Record<
  string,
  { bg: string; text: string; dot: string; label: string }
> = {
  Active: {
    bg: Colors.riskActiveLight,
    text: Colors.riskActive,
    dot: Colors.riskActive,
    label: "Active",
  },
  "At-Risk": {
    bg: Colors.riskAtRiskLight,
    text: Colors.riskAtRisk,
    dot: Colors.riskAtRisk,
    label: "At-Risk",
  },
  Disengaged: {
    bg: Colors.riskDisengagedLight,
    text: Colors.riskDisengaged,
    dot: Colors.riskDisengaged,
    label: "Disengaged",
  },
  Dropout: {
    bg: Colors.riskDropoutLight,
    text: Colors.riskDropout,
    dot: Colors.riskDropout,
    label: "High Risk",
  },
};

const getBandStyle = (band: string) =>
  BAND_STYLES[band] ?? BAND_STYLES["At-Risk"];

// ── Filters ───────────────────────────────────────────────────────────────────

const FILTERS = ["All", "High Risk", "At-Risk", "Disengaged", "Active"];

export default function CaseloadScreen() {
  const router = useRouter();
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [filtered, setFiltered] = useState<Beneficiary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const data = await getMyCaseload();
      // Sort by dropout probability descending — highest risk first
      const sorted = [...data].sort(
        (a, b) => (b.dropoutProb ?? 0) - (a.dropoutProb ?? 0)
      );
      setBeneficiaries(sorted);
      setFiltered(sorted);
    } catch {
      setError("Could not load caseload. Pull down to retry.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Apply search + filter
  useEffect(() => {
    let result = beneficiaries;

    if (activeFilter !== "All") {
      const bandMap: Record<string, string> = {
        "High Risk": "Dropout",
        "At-Risk": "At-Risk",
        Disengaged: "Disengaged",
        Active: "Active",
      };
      result = result.filter((b) => b.predictedBand === bandMap[activeFilter]);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (b) =>
          b.beneficiaryId.toLowerCase().includes(q) ||
          b.cohortId?.toLowerCase().includes(q) ||
          b.county?.toLowerCase().includes(q) ||
          b.pillar?.toLowerCase().includes(q)
      );
    }

    setFiltered(result);
  }, [search, activeFilter, beneficiaries]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading caseload…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons
          name="search-outline"
          size={18}
          color={Colors.textMuted}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="Search by ID, cohort, county…"
          placeholderTextColor={Colors.textMuted}
          clearButtonMode="while-editing"
        />
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[
              styles.chip,
              activeFilter === f && styles.chipActive,
            ]}
            onPress={() => setActiveFilter(f)}
          >
            <Text
              style={[
                styles.chipText,
                activeFilter === f && styles.chipTextActive,
              ]}
            >
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Count */}
      <Text style={styles.countText}>
        {filtered.length} of {beneficiaries.length} beneficiaries
      </Text>

      {/* Error */}
      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* List */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.beneficiaryId}
        renderItem={({ item }) => (
          <BeneficiaryCard
            beneficiary={item}
            onPress={() =>
              router.push({
                pathname: "/(app)/beneficiary/[id]",
                params: { id: item.beneficiaryId },
              })
            }
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.centered}>
            <Ionicons name="people-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No beneficiaries found</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

// ── BeneficiaryCard ───────────────────────────────────────────────────────────

function BeneficiaryCard({
  beneficiary: b,
  onPress,
}: {
  beneficiary: Beneficiary;
  onPress: () => void;
}) {
  const band = getBandStyle(b.predictedBand);
  const pct = b.dropoutProb != null ? Math.round(b.dropoutProb * 100) : null;

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.75}
    >
      {/* Left: risk dot + ID */}
      <View style={[styles.riskBar, { backgroundColor: band.dot }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardHeader}>
          <Text style={styles.beneficiaryId}>{b.beneficiaryId}</Text>
          <View style={[styles.bandBadge, { backgroundColor: band.bg }]}>
            <Text style={[styles.bandText, { color: band.text }]}>
              {band.label}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          {b.cohortId ? (
            <MetaChip icon="grid-outline" label={b.cohortId} />
          ) : null}
          {b.county ? (
            <MetaChip icon="location-outline" label={b.county} />
          ) : null}
          {b.pillar ? (
            <MetaChip icon="layers-outline" label={b.pillar} />
          ) : null}
        </View>

        {/* Risk probability bar */}
        {pct != null && (
          <View style={styles.probRow}>
            <View style={styles.probBar}>
              <View
                style={[
                  styles.probFill,
                  {
                    width: `${pct}%` as `${number}%`,
                    backgroundColor: band.dot,
                  },
                ]}
              />
            </View>
            <Text style={[styles.probText, { color: band.text }]}>
              {pct}% dropout risk
            </Text>
          </View>
        )}
      </View>
      <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
    </TouchableOpacity>
  );
}

function MetaChip({
  icon,
  label,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  return (
    <View style={styles.metaChip}>
      <Ionicons name={icon} size={11} color={Colors.textSecondary} />
      <Text style={styles.metaText}>{label}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingTop: 60,
  },
  loadingText: { color: Colors.textSecondary, fontSize: 14 },
  emptyText: { color: Colors.textSecondary, fontSize: 14 },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    margin: 12,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: Colors.text },

  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary },
  chipTextActive: { color: "#fff" },

  countText: {
    fontSize: 12,
    color: Colors.textMuted,
    paddingHorizontal: 16,
    marginBottom: 8,
  },

  errorBanner: {
    margin: 12,
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    padding: 12,
  },
  errorText: { color: "#991B1B", fontSize: 13 },

  listContent: { paddingHorizontal: 12, paddingBottom: 40 },

  // Card
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    marginBottom: 10,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  riskBar: { width: 5, alignSelf: "stretch" },
  cardBody: { flex: 1, padding: 14 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  beneficiaryId: { fontSize: 15, fontWeight: "700", color: Colors.text },
  bandBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  bandText: { fontSize: 11, fontWeight: "700" },

  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  metaChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.background,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  metaText: { fontSize: 11, color: Colors.textSecondary },

  probRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  probBar: {
    flex: 1,
    height: 5,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: "hidden",
  },
  probFill: { height: "100%", borderRadius: 3 },
  probText: { fontSize: 11, fontWeight: "700", minWidth: 90 },
});
