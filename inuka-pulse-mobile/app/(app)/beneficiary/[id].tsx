import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useEffect, useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { getBeneficiary, getFollowUps } from "../../../src/api/client";
import type { Beneficiary, FollowUp } from "../../../src/api/client";
import { Colors } from "../../../src/constants";

const BAND_CONFIG: Record<
  string,
  { bg: string; text: string; border: string; label: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  Active: {
    bg: Colors.riskActiveLight,
    text: Colors.riskActive,
    border: Colors.riskActive,
    label: "Active",
    icon: "checkmark-circle",
  },
  "At-Risk": {
    bg: Colors.riskAtRiskLight,
    text: Colors.riskAtRisk,
    border: Colors.riskAtRisk,
    label: "At-Risk",
    icon: "alert-circle",
  },
  Disengaged: {
    bg: Colors.riskDisengagedLight,
    text: Colors.riskDisengaged,
    border: Colors.riskDisengaged,
    label: "Disengaged",
    icon: "remove-circle",
  },
  Dropout: {
    bg: Colors.riskDropoutLight,
    text: Colors.riskDropout,
    border: Colors.riskDropout,
    label: "High Risk",
    icon: "close-circle",
  },
};

const getBand = (band: string) => BAND_CONFIG[band] ?? BAND_CONFIG["At-Risk"];

export default function BeneficiaryProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const [beneficiary, setBeneficiary] = useState<Beneficiary | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    Promise.all([getBeneficiary(id), getFollowUps(id)])
      .then(([b, f]) => {
        setBeneficiary(b);
        setFollowUps(f);
      })
      .catch(() => setError("Could not load beneficiary data."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error || !beneficiary) {
    return (
      <View style={styles.centered}>
        <Ionicons name="warning-outline" size={40} color={Colors.accent} />
        <Text style={styles.errorText}>{error ?? "Beneficiary not found."}</Text>
      </View>
    );
  }

  const band = getBand(beneficiary.predictedBand);
  const dropoutPct =
    beneficiary.dropoutProb != null
      ? Math.round(beneficiary.dropoutProb * 100)
      : null;
  const engagementPct =
    beneficiary.engagementScore != null
      ? Math.round(beneficiary.engagementScore)
      : null;

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView contentContainerStyle={styles.content}>

        {/* Risk header card */}
        <View style={[styles.riskCard, { borderColor: band.border }]}>
          <View style={styles.riskCardHeader}>
            <View>
              <Text style={styles.beneficiaryId}>{beneficiary.beneficiaryId}</Text>
              <Text style={styles.cohortLabel}>{beneficiary.cohortId}</Text>
            </View>
            <View style={[styles.bandPill, { backgroundColor: band.bg }]}>
              <Ionicons name={band.icon} size={16} color={band.text} />
              <Text style={[styles.bandPillText, { color: band.text }]}>
                {band.label}
              </Text>
            </View>
          </View>

          {/* Dropout probability gauge */}
          {dropoutPct != null && (
            <View style={styles.gaugeSection}>
              <View style={styles.gaugeLabelRow}>
                <Text style={styles.gaugeLabel}>Dropout Risk</Text>
                <Text style={[styles.gaugeValue, { color: band.text }]}>
                  {dropoutPct}%
                </Text>
              </View>
              <View style={styles.gaugeTrack}>
                <View
                  style={[
                    styles.gaugeFill,
                    {
                      width: `${dropoutPct}%` as `${number}%`,
                      backgroundColor: band.border,
                    },
                  ]}
                />
              </View>
            </View>
          )}

          {/* Engagement score */}
          {engagementPct != null && (
            <View style={styles.gaugeSection}>
              <View style={styles.gaugeLabelRow}>
                <Text style={styles.gaugeLabel}>Engagement Score</Text>
                <Text
                  style={[
                    styles.gaugeValue,
                    {
                      color:
                        beneficiary.engagementBand === "High"
                          ? Colors.riskActive
                          : beneficiary.engagementBand === "Low"
                          ? Colors.accent
                          : Colors.riskAtRisk,
                    },
                  ]}
                >
                  {engagementPct}/100
                </Text>
              </View>
              <View style={styles.gaugeTrack}>
                <View
                  style={[
                    styles.gaugeFill,
                    {
                      width: `${engagementPct}%` as `${number}%`,
                      backgroundColor:
                        beneficiary.engagementBand === "High"
                          ? Colors.riskActive
                          : beneficiary.engagementBand === "Low"
                          ? Colors.accent
                          : Colors.riskAtRisk,
                    },
                  ]}
                />
              </View>
            </View>
          )}
        </View>

        {/* Details */}
        <SectionHeader title="Profile" />
        <View style={styles.detailsCard}>
          <DetailRow icon="grid-outline" label="Cohort" value={beneficiary.cohortId} />
          <DetailRow icon="layers-outline" label="Pillar" value={beneficiary.pillar} />
          <DetailRow icon="location-outline" label="County" value={beneficiary.county} />
          <DetailRow
            icon="calendar-outline"
            label="Assessment Date"
            value={beneficiary.asOfDate ?? "—"}
            isLast
          />
        </View>

        {/* Top risk factors */}
        {beneficiary.topFeaturesList?.length > 0 && (
          <>
            <SectionHeader title="Top Risk Factors" />
            <View style={styles.detailsCard}>
              {beneficiary.topFeaturesList.map((feature, i) => (
                <View
                  key={i}
                  style={[
                    styles.featureRow,
                    i < beneficiary.topFeaturesList.length - 1 &&
                      styles.featureDivider,
                  ]}
                >
                  <View
                    style={[
                      styles.featureRank,
                      { backgroundColor: i === 0 ? Colors.accent : Colors.primary },
                    ]}
                  >
                    <Text style={styles.featureRankText}>{i + 1}</Text>
                  </View>
                  <Text style={styles.featureText}>{feature}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Visit history */}
        <SectionHeader title={`Visit History (${followUps.length})`} />
        {followUps.length === 0 ? (
          <View style={styles.emptyHistory}>
            <Ionicons name="clipboard-outline" size={32} color={Colors.textMuted} />
            <Text style={styles.emptyHistoryText}>No visits recorded yet</Text>
          </View>
        ) : (
          <View style={styles.detailsCard}>
            {followUps.slice(0, 5).map((fu, i) => (
              <View
                key={fu.id}
                style={[i < followUps.length - 1 && styles.featureDivider]}
              >
                <View style={styles.followUpRow}>
                  <View style={styles.followUpMeta}>
                    <Text style={styles.followUpType}>{fu.contactTypeLabel}</Text>
                    <Text style={styles.followUpDate}>{fu.followUpDate}</Text>
                  </View>
                  <OutcomeBadge outcome={fu.outcome} />
                </View>
                {fu.notes ? (
                  <Text style={styles.followUpNotes} numberOfLines={2}>
                    {fu.notes}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        )}

        {/* Submit visit CTA */}
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() =>
            router.push({
              pathname: "/(app)/visit/[beneficiaryId]",
              params: { beneficiaryId: beneficiary.beneficiaryId },
            })
          }
          activeOpacity={0.85}
        >
          <Ionicons name="add-circle-outline" size={20} color="#fff" />
          <Text style={styles.ctaText}>Submit Field Visit</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function DetailRow({
  icon,
  label,
  value,
  isLast,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.detailRow, !isLast && styles.detailDivider]}>
      <Ionicons name={icon} size={16} color={Colors.textSecondary} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const outcomeColors: Record<string, { bg: string; text: string }> = {
    reached: { bg: Colors.riskActiveLight, text: Colors.riskActive },
    no_answer: { bg: Colors.riskAtRiskLight, text: Colors.riskAtRisk },
    escalated: { bg: Colors.riskDropoutLight, text: Colors.riskDropout },
    left_message: { bg: "#EDE9FE", text: "#6D28D9" },
  };
  const c = outcomeColors[outcome] ?? { bg: Colors.border, text: Colors.textSecondary };
  return (
    <View style={[styles.outcomeBadge, { backgroundColor: c.bg }]}>
      <Text style={[styles.outcomeBadgeText, { color: c.text }]}>{outcome.replace("_", " ")}</Text>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 },
  errorText: { color: Colors.textSecondary, fontSize: 14, textAlign: "center", paddingHorizontal: 32 },

  riskCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 18,
    borderWidth: 2,
    marginBottom: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  riskCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  beneficiaryId: { fontSize: 20, fontWeight: "800", color: Colors.text },
  cohortLabel: { fontSize: 13, color: Colors.textSecondary, marginTop: 2 },
  bandPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  bandPillText: { fontSize: 13, fontWeight: "700" },

  gaugeSection: { marginBottom: 12 },
  gaugeLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  gaugeLabel: { fontSize: 13, color: Colors.textSecondary, fontWeight: "500" },
  gaugeValue: { fontSize: 14, fontWeight: "800" },
  gaugeTrack: {
    height: 8,
    backgroundColor: Colors.border,
    borderRadius: 4,
    overflow: "hidden",
  },
  gaugeFill: { height: "100%", borderRadius: 4 },

  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
  },

  detailsCard: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 13,
    gap: 10,
  },
  detailDivider: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  detailLabel: { fontSize: 13, color: Colors.textSecondary, flex: 1 },
  detailValue: { fontSize: 14, fontWeight: "600", color: Colors.text },

  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  featureDivider: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  featureRank: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  featureRankText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  featureText: { fontSize: 13, color: Colors.text, flex: 1 },

  emptyHistory: { alignItems: "center", padding: 24, gap: 8 },
  emptyHistoryText: { color: Colors.textMuted, fontSize: 13 },

  followUpRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 13,
    paddingBottom: 4,
  },
  followUpMeta: { gap: 2 },
  followUpType: { fontSize: 13, fontWeight: "600", color: Colors.text },
  followUpDate: { fontSize: 12, color: Colors.textSecondary },
  followUpNotes: {
    fontSize: 12,
    color: Colors.textSecondary,
    paddingHorizontal: 16,
    paddingBottom: 12,
    fontStyle: "italic",
  },
  outcomeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  outcomeBadgeText: { fontSize: 11, fontWeight: "700" },

  ctaButton: {
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 24,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
