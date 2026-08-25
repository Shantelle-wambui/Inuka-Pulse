import { View, Text, StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: "1px solid #e5e5e5",
    paddingTop: 8,
  },
  text: {
    fontSize: 7,
    color: "#999",
  },
  confidential: {
    fontSize: 7,
    color: "#C42152",
    fontFamily: "Helvetica-Bold",
  },
});

interface ReportFooterProps {
  confidential?: boolean;
}

export function ReportFooter({ confidential = true }: ReportFooterProps) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.text}>Inuka Pulse — Programme Impact & M&E Intelligence Platform</Text>
      {confidential && <Text style={styles.confidential}>CONFIDENTIAL</Text>}
      <Text
        style={styles.text}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
}
