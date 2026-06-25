import { View, Text, Pressable, StyleSheet, ScrollView, Linking, Switch, Alert } from "react-native";
import { useState } from "react";
import { C, API_BASE } from "../config";

export function SettingsScreen({
  onOpenMenu,
  onSignOut,
}: {
  onOpenMenu: () => void;
  onSignOut: () => void;
}) {
  const [notifSound, setNotifSound] = useState(true);
  const [keepAwake, setKeepAwake] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={s.header}>
        <Pressable onPress={onOpenMenu} hitSlop={12} style={s.burger}>
          <View style={s.bar} />
          <View style={s.bar} />
          <View style={s.bar} />
        </Pressable>
        <Text style={s.title}>Settings</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={s.section}>Notifications</Text>
        <View style={s.card}>
          <ToggleRow
            label="In-app notifications"
            value={notifSound}
            onValueChange={setNotifSound}
          />
          <ToggleRow
            label="Keep screen on while driving"
            value={keepAwake}
            onValueChange={setKeepAwake}
            last
          />
        </View>

        <Text style={s.section}>About</Text>
        <View style={s.card}>
          <InfoRow label="App" value="LoadSprint Driver" />
          <InfoRow label="Version" value="1.0.0" />
          <InfoRow label="Connected to" value={API_BASE.replace(/^https?:\/\//, "")} last />
        </View>

        <Text style={s.section}>Support</Text>
        <View style={s.card}>
          <LinkRow
            label="Contact your dispatcher"
            onPress={() =>
              Alert.alert("Dispatcher", "Use the chat inside any load to message your dispatcher.")
            }
          />
          <LinkRow
            label="Open website"
            onPress={() => Linking.openURL(API_BASE).catch(() => {})}
            last
          />
        </View>

        <Pressable style={s.signout} onPress={onSignOut}>
          <Text style={s.signoutText}>Log out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
  last,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <View style={[s.row, last && { borderBottomWidth: 0 }]}>
      <Text style={s.rowLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: C.blue, false: "#33415a" }}
        thumbColor="#fff"
      />
    </View>
  );
}

function InfoRow({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[s.row, last && { borderBottomWidth: 0 }]}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

function LinkRow({ label, onPress, last }: { label: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable style={[s.row, last && { borderBottomWidth: 0 }]} onPress={onPress}>
      <Text style={[s.rowLabel, { color: C.sky, fontWeight: "600" }]}>{label}</Text>
      <Text style={{ color: C.muted }}>›</Text>
    </Pressable>
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
  section: { color: C.muted, fontSize: 13, fontWeight: "700", textTransform: "uppercase", marginTop: 20, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: C.card, borderColor: C.line, borderWidth: 1, borderRadius: 14, paddingHorizontal: 4 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.line,
  },
  rowLabel: { color: C.text, fontSize: 15 },
  rowValue: { color: C.muted, fontSize: 14, flexShrink: 1, textAlign: "right", marginLeft: 12 },
  signout: {
    marginTop: 28,
    backgroundColor: "rgba(239,68,68,0.10)",
    borderColor: C.danger,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  signoutText: { color: "#fca5a5", fontSize: 16, fontWeight: "700" },
});
