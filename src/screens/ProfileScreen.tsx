import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { C } from "../config";

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "DR";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

export function ProfileScreen({
  name,
  email,
  onOpenMenu,
}: {
  name: string;
  email: string;
  onOpenMenu: () => void;
}) {
  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.header}>
        <Pressable onPress={onOpenMenu} hitSlop={12} style={s.burger}>
          <View style={s.bar} />
          <View style={s.bar} />
          <View style={s.bar} />
        </Pressable>
        <Text style={s.title}>Profile</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 24, alignItems: "center" }}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{initials(name)}</Text>
        </View>
        <Text style={s.name}>{name || "Driver"}</Text>
        {!!email && <Text style={s.email}>{email}</Text>}

        <View style={s.card}>
          <Row label="Name" value={name || "—"} />
          <Row label="Email" value={email || "—"} />
          <Row label="Role" value="Driver" />
        </View>

        <Text style={s.note}>
          To change your name or email, ask your dispatcher to update your account.
        </Text>
      </ScrollView>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 6,
    paddingBottom: 4,
  },
  burger: { width: 26, height: 20, justifyContent: "space-between", paddingVertical: 2 },
  bar: { height: 2.4, borderRadius: 2, backgroundColor: C.text },
  title: { fontSize: 20, fontWeight: "800", color: C.text },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: C.blue,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    marginBottom: 14,
  },
  avatarText: { color: "#fff", fontSize: 30, fontWeight: "800" },
  name: { color: C.text, fontSize: 22, fontWeight: "800" },
  email: { color: C.muted, fontSize: 14, marginTop: 4 },
  card: {
    width: "100%",
    backgroundColor: C.card,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 6,
    marginTop: 24,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  rowLabel: { color: C.muted, fontSize: 14 },
  rowValue: { color: C.text, fontSize: 15, fontWeight: "600", flexShrink: 1, textAlign: "right", marginLeft: 12 },
  note: { color: C.muted, fontSize: 13, textAlign: "center", marginTop: 20, lineHeight: 19 },
});
