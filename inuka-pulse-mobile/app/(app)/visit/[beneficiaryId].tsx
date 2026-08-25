import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useState } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { recordFollowUp } from "../../../src/api/client";
import { Colors } from "../../../src/constants";

// ── Option data ───────────────────────────────────────────────────────────────

const CONTACT_TYPES = [
  { value: "home_visit", label: "Home Visit", icon: "home-outline" as const },
  { value: "phone_call", label: "Phone Call", icon: "call-outline" as const },
  { value: "sms", label: "SMS", icon: "chatbubble-outline" as const },
  { value: "other", label: "Other", icon: "ellipsis-horizontal-circle-outline" as const },
];

const OUTCOMES = [
  { value: "reached", label: "Reached — spoke with beneficiary", color: Colors.riskActive },
  { value: "no_answer", label: "No answer", color: Colors.riskAtRisk },
  { value: "left_message", label: "Left message / voicemail", color: "#6D28D9" },
  { value: "escalated", label: "Escalated — welfare concern raised", color: Colors.accent },
];

export default function SubmitVisitScreen() {
  const { beneficiaryId } = useLocalSearchParams<{ beneficiaryId: string }>();
  const router = useRouter();

  const [contactType, setContactType] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [nextAction, setNextAction] = useState("");
  const [beneficiaryIdInput, setBeneficiaryIdInput] = useState(
    beneficiaryId !== "select" ? (beneficiaryId ?? "") : ""
  );
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit =
    beneficiaryIdInput.trim() &&
    contactType &&
    outcome &&
    !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      await recordFollowUp(beneficiaryIdInput.trim(), {
        contactType: contactType!,
        outcome: outcome!,
        notes: notes.trim() || undefined,
        nextAction: nextAction.trim() || undefined,
        followUpDate: new Date().toISOString().split("T")[0],
      });
      setSubmitted(true);
    } catch (e: unknown) {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data
          ?.message ?? "Submission failed. Please try again.";
      Alert.alert("Error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  // Success state
  if (submitted) {
    return (
      <SafeAreaView style={styles.safe} edges={["bottom"]}>
        <View style={styles.successContainer}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark" size={40} color="#fff" />
          </View>
          <Text style={styles.successTitle}>Visit Recorded</Text>
          <Text style={styles.successSub}>
            The follow-up for {beneficiaryIdInput} has been saved successfully.
          </Text>
          <TouchableOpacity
            style={styles.successBtn}
            onPress={() => router.back()}
            activeOpacity={0.85}
          >
            <Text style={styles.successBtnText}>Back to Profile</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.successBtnOutline}
            onPress={() => {
              setSubmitted(false);
              setContactType(null);
              setOutcome(null);
              setNotes("");
              setNextAction("");
              setBeneficiaryIdInput("");
            }}
            activeOpacity={0.85}
          >
            <Text style={styles.successBtnOutlineText}>Submit Another</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["bottom"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Beneficiary ID */}
        <Text style={styles.sectionTitle}>Beneficiary</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Beneficiary ID *</Text>
          <TextInput
            style={styles.input}
            value={beneficiaryIdInput}
            onChangeText={setBeneficiaryIdInput}
            placeholder="e.g. BEN-001"
            placeholderTextColor={Colors.textMuted}
            autoCapitalize="characters"
            editable={beneficiaryId === "select"}
          />
          {beneficiaryId !== "select" && (
            <Text style={styles.hint}>Pre-filled from beneficiary profile</Text>
          )}
        </View>

        {/* Contact type */}
        <Text style={styles.sectionTitle}>Visit Type *</Text>
        <View style={styles.optionGrid}>
          {CONTACT_TYPES.map((ct) => (
            <TouchableOpacity
              key={ct.value}
              style={[
                styles.optionCard,
                contactType === ct.value && styles.optionCardSelected,
              ]}
              onPress={() => setContactType(ct.value)}
              activeOpacity={0.75}
            >
              <Ionicons
                name={ct.icon}
                size={24}
                color={contactType === ct.value ? Colors.primary : Colors.textSecondary}
              />
              <Text
                style={[
                  styles.optionLabel,
                  contactType === ct.value && styles.optionLabelSelected,
                ]}
              >
                {ct.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Outcome */}
        <Text style={styles.sectionTitle}>Outcome *</Text>
        <View style={styles.card}>
          {OUTCOMES.map((o, i) => (
            <TouchableOpacity
              key={o.value}
              style={[
                styles.outcomeRow,
                i < OUTCOMES.length - 1 && styles.outcomeDivider,
                outcome === o.value && styles.outcomeRowSelected,
              ]}
              onPress={() => setOutcome(o.value)}
              activeOpacity={0.75}
            >
              <View
                style={[
                  styles.radio,
                  outcome === o.value && {
                    borderColor: o.color,
                    backgroundColor: o.color,
                  },
                ]}
              >
                {outcome === o.value && (
                  <View style={styles.radioDot} />
                )}
              </View>
              <Text
                style={[
                  styles.outcomeLabel,
                  outcome === o.value && { color: o.color, fontWeight: "600" },
                ]}
              >
                {o.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Notes */}
        <Text style={styles.sectionTitle}>Observations & Notes</Text>
        <View style={styles.card}>
          <TextInput
            style={styles.textArea}
            value={notes}
            onChangeText={setNotes}
            placeholder="What did you observe during this visit? Any concerns, positive developments, or context that will help the team understand the beneficiary's situation…"
            placeholderTextColor={Colors.textMuted}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </View>

        {/* Next action */}
        <Text style={styles.sectionTitle}>Next Action (optional)</Text>
        <View style={styles.card}>
          <TextInput
            style={styles.input}
            value={nextAction}
            onChangeText={setNextAction}
            placeholder="e.g. Follow up in 2 weeks, Refer to counsellor"
            placeholderTextColor={Colors.textMuted}
          />
        </View>

        {/* Date */}
        <View style={styles.dateRow}>
          <Ionicons name="calendar-outline" size={14} color={Colors.textMuted} />
          <Text style={styles.dateText}>
            Visit date: {new Date().toLocaleDateString("en-KE", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </Text>
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
          activeOpacity={0.85}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
              <Text style={styles.submitBtnText}>Submit Visit Record</Text>
            </>
          )}
        </TouchableOpacity>

        {!canSubmit && !submitting && (
          <Text style={styles.validationHint}>
            Please fill in beneficiary ID, visit type, and outcome to submit.
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: 16, paddingBottom: 48 },

  sectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 20,
  },

  card: {
    backgroundColor: Colors.surface,
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },

  label: { fontSize: 13, fontWeight: "600", color: Colors.text, marginBottom: 8 },
  hint: { fontSize: 11, color: Colors.textMuted, marginTop: 6 },

  input: {
    borderWidth: 1.5,
    borderColor: Colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.text,
    backgroundColor: Colors.background,
  },

  textArea: {
    fontSize: 14,
    color: Colors.text,
    minHeight: 100,
    lineHeight: 20,
  },

  // Contact type grid
  optionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  optionCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    gap: 6,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  optionCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: "#E6F7F8",
  },
  optionLabel: { fontSize: 12, fontWeight: "600", color: Colors.textSecondary, textAlign: "center" },
  optionLabelSelected: { color: Colors.primary },

  // Outcome rows
  outcomeRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    gap: 12,
  },
  outcomeDivider: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  outcomeRowSelected: { backgroundColor: Colors.background, borderRadius: 8 },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: "center",
    alignItems: "center",
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#fff",
  },
  outcomeLabel: { fontSize: 13, color: Colors.text, flex: 1 },

  // Date
  dateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 16,
    marginBottom: 4,
  },
  dateText: { fontSize: 12, color: Colors.textMuted },

  // Submit button
  submitBtn: {
    backgroundColor: Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 14,
    paddingVertical: 16,
    marginTop: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: { opacity: 0.45, shadowOpacity: 0 },
  submitBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  validationHint: {
    textAlign: "center",
    color: Colors.textMuted,
    fontSize: 12,
    marginTop: 8,
  },

  // Success screen
  successContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 16,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  successTitle: { fontSize: 24, fontWeight: "800", color: Colors.text },
  successSub: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 21,
  },
  successBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 8,
  },
  successBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  successBtnOutline: {
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 40,
  },
  successBtnOutlineText: { color: Colors.primary, fontSize: 16, fontWeight: "700" },
});
