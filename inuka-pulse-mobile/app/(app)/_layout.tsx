import { Stack } from "expo-router";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Colors } from "../../src/constants";

function HeaderTitle({ title }: { title: string }) {
  return (
    <View style={styles.headerTitleContainer}>
      <Text style={styles.headerTitleText}>{title}</Text>
    </View>
  );
}

function InukaLogo() {
  return (
    <View style={styles.logoMark}>
      <Text style={styles.logoMarkText}>IP</Text>
    </View>
  );
}

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: Colors.primary },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "700", fontSize: 18 },
        headerTitleAlign: "center",
        contentStyle: { backgroundColor: Colors.background },
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="home"
        options={{
          headerLeft: () => <InukaLogo />,
          title: "Inuka Pulse",
        }}
      />
      <Stack.Screen
        name="caseload"
        options={{
          title: "My Caseload",
          headerBackTitle: "Home",
        }}
      />
      <Stack.Screen
        name="beneficiary/[id]"
        options={{
          title: "Beneficiary",
          headerBackTitle: "Caseload",
        }}
      />
      <Stack.Screen
        name="visit/[beneficiaryId]"
        options={{
          title: "Submit Visit",
          headerBackTitle: "Back",
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  headerTitleContainer: { alignItems: "center" },
  headerTitleText: { color: "#fff", fontSize: 18, fontWeight: "700" },
  logoMark: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 4,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.3)",
  },
  logoMarkText: { color: "#fff", fontSize: 13, fontWeight: "800" },
});
