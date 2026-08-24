import { View, Text, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  table: {
    marginVertical: 10,
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: "#C42152",
    padding: "6px 8px",
    borderRadius: 3,
  },
  headerCell: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#ffffff",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  row: {
    flexDirection: "row",
    padding: "5px 8px",
    borderBottom: "0.5px solid #eee",
  },
  rowAlt: {
    backgroundColor: "#fafafa",
  },
  cell: {
    fontSize: 8,
    color: "#333",
  },
  emptyState: {
    padding: 20,
    textAlign: "center",
    fontSize: 9,
    color: "#999",
  },
});

interface Column {
  key: string;
  header: string;
  width?: number; // flex value, default 1
  align?: "left" | "center" | "right";
}

interface PdfTableProps {
  columns: Column[];
  data: Record<string, any>[];
  maxRows?: number;
}

export function PdfTable({ columns, data, maxRows }: PdfTableProps) {
  const rows = maxRows ? data.slice(0, maxRows) : data;

  if (rows.length === 0) {
    return (
      <View style={styles.table}>
        <Text style={styles.emptyState}>No data available for this report period.</Text>
      </View>
    );
  }

  return (
    <View style={styles.table}>
      {/* Header */}
      <View style={styles.headerRow}>
        {columns.map((col) => (
          <Text
            key={col.key}
            style={[
              styles.headerCell,
              { flex: col.width ?? 1, textAlign: col.align ?? "left" },
            ]}
          >
            {col.header}
          </Text>
        ))}
      </View>

      {/* Body */}
      {rows.map((row, i) => (
        <View key={i} style={[styles.row, i % 2 === 1 ? styles.rowAlt : {}]}>
          {columns.map((col) => (
            <Text
              key={col.key}
              style={[
                styles.cell,
                { flex: col.width ?? 1, textAlign: col.align ?? "left" },
              ]}
            >
              {row[col.key] ?? "—"}
            </Text>
          ))}
        </View>
      ))}

      {maxRows && data.length > maxRows && (
        <Text style={{ fontSize: 7, color: "#999", marginTop: 4, textAlign: "right" }}>
          Showing {maxRows} of {data.length} rows
        </Text>
      )}
    </View>
  );
}
