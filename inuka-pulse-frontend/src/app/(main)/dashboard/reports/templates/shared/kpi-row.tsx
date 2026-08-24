import { View, Text, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
    marginVertical: 12,
  },
  card: {
    flex: 1,
    backgroundColor: "#fafafa",
    borderRadius: 4,
    padding: "10px 12px",
    borderLeft: "3px solid #00999E",
  },
  label: {
    fontSize: 8,
    color: "#666",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#1a1a1a",
  },
  subtext: {
    fontSize: 7,
    color: "#999",
    marginTop: 2,
  },
});

interface KpiItem {
  label: string;
  value: string | number;
  subtext?: string;
  color?: string;
}

interface KpiRowProps {
  items: KpiItem[];
}

export function KpiRow({ items }: KpiRowProps) {
  return (
    <View style={styles.row}>
      {items.map((item) => (
        <View
          key={item.label}
          style={[styles.card, item.color ? { borderLeftColor: item.color } : {}]}
        >
          <Text style={styles.label}>{item.label}</Text>
          <Text style={[styles.value, item.color ? { color: item.color } : {}]}>
            {item.value}
          </Text>
          {item.subtext && <Text style={styles.subtext}>{item.subtext}</Text>}
        </View>
      ))}
    </View>
  );
}
