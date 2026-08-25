import { View, Text, StyleSheet, Image } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    borderBottom: "2px solid #C42152",
    paddingBottom: 12,
    marginBottom: 20,
  },
  left: {
    flexDirection: "column",
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#C42152",
  },
  subtitle: {
    fontSize: 9,
    color: "#666",
  },
  right: {
    flexDirection: "column",
    alignItems: "flex-end",
    gap: 2,
  },
  brand: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#00999E",
  },
  date: {
    fontSize: 8,
    color: "#999",
  },
  filters: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  filterBadge: {
    backgroundColor: "#f0f9f9",
    borderRadius: 3,
    padding: "2px 6px",
    fontSize: 8,
    color: "#00999E",
  },
});

interface ReportHeaderProps {
  title: string;
  subtitle?: string;
  filters?: Record<string, string | undefined>;
}

export function ReportHeader({ title, subtitle, filters }: ReportHeaderProps) {
  const activeFilters = filters
    ? Object.entries(filters).filter(([, v]) => v)
    : [];

  return (
    <View style={styles.header}>
      <View style={styles.left}>
        <Text style={styles.title}>{title}</Text>
        {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        {activeFilters.length > 0 && (
          <View style={styles.filters}>
            {activeFilters.map(([key, value]) => (
              <Text key={key} style={styles.filterBadge}>
                {key}: {value}
              </Text>
            ))}
          </View>
        )}
      </View>
      <View style={styles.right}>
        <Text style={styles.brand}>Inuka Pulse</Text>
        <Text style={styles.date}>
          Generated: {new Date().toLocaleDateString("en-KE", { year: "numeric", month: "long", day: "numeric" })}
        </Text>
        <Text style={styles.date}>
          {new Date().toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" })}
        </Text>
      </View>
    </View>
  );
}
