import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { C } from "../config";
import {
  getMyLoads,
  getNotifications,
  markNotificationsRead,
  type LoadListItem,
  type Notif,
} from "../api";

const DONE = ["Delivered", "Closed"];

export function LoadsScreen({
  name,
  mode,
  onOpenLoad,
  onOpenMenu,
}: {
  name: string;
  mode: "active" | "history";
  onOpenLoad: (id: string) => void;
  onOpenMenu: () => void;
}) {
  const [loads, setLoads] = useState<LoadListItem[] | null>(null);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAll = useCallback(async () => {
    const [l, n] = await Promise.all([getMyLoads(), getNotifications()]);
    if (l.ok) setLoads(l.data.loads);
    if (n.ok) setNotifs(n.data.items);
  }, []);

  useEffect(() => {
    fetchAll();
    const t = setInterval(fetchAll, 15000);
    return () => clearInterval(t);
  }, [fetchAll]);

  async function onRefresh() {
    setRefreshing(true);
    await fetchAll();
    setRefreshing(false);
  }

  async function markRead() {
    await markNotificationsRead();
    setNotifs((arr) => arr.map((x) => ({ ...x, read: true })));
  }

  const unread = notifs.filter((n) => !n.read);
  const filtered =
    loads === null
      ? null
      : loads.filter((l) =>
          mode === "history" ? DONE.includes(l.status) : !DONE.includes(l.status)
        );

  const title = mode === "history" ? "History" : "Loads";

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      {/* Header with hamburger */}
      <View style={s.header}>
        <Pressable onPress={onOpenMenu} hitSlop={12} style={s.burger}>
          <View style={s.bar} />
          <View style={s.bar} />
          <View style={s.bar} />
        </Pressable>
        <Text style={s.title}>{title}</Text>
        <View style={{ width: 26 }} />
      </View>

      {mode === "active" && (
        <Text style={s.hi}>Hi {name?.split(" ")[0] || "driver"} — your active loads</Text>
      )}

      {mode === "active" && unread.length > 0 && (
        <View style={s.notif}>
          <View style={s.notifTop}>
            <Text style={s.notifTitle}>🔔 {unread.length} new</Text>
            <Pressable onPress={markRead} hitSlop={8}>
              <Text style={s.markRead}>Mark read</Text>
            </Pressable>
          </View>
          {unread.slice(0, 5).map((n) => (
            <Text key={n.id} style={s.notifLine}>
              <Text style={{ color: C.sky, fontWeight: "700" }}>{n.loadRef}</Text> — {n.text}
            </Text>
          ))}
        </View>
      )}

      {filtered === null ? (
        <ActivityIndicator color={C.sky} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(l) => l.id}
          contentContainerStyle={{ padding: 16, paddingTop: 4 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.sky} />
          }
          ListEmptyComponent={
            <Text style={s.empty}>
              {mode === "history" ? "No delivered loads yet." : "No active loads."}
            </Text>
          }
          renderItem={({ item }) => (
            <Pressable style={s.card} onPress={() => onOpenLoad(item.id)}>
              <View style={s.cardTop}>
                <Text style={s.ref}>{item.ref}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  {item.sharing ? (
                    <View style={s.locLive}>
                      <Text style={s.locLiveText}>📍 On</Text>
                    </View>
                  ) : (
                    <View style={s.locOff}>
                      <Text style={s.locOffText}>📍 Off</Text>
                    </View>
                  )}
                  <Pill status={item.status} />
                </View>
              </View>
              <Text style={s.route}>
                {item.originName} → {item.destName}
              </Text>
              <Text style={s.meta}>
                {item.docCount} files · {item.photoCount} photos
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

export function Pill({ status }: { status: string }) {
  const done = DONE.includes(status);
  return (
    <View style={[s.pill, done && { backgroundColor: "rgba(74,222,128,0.12)", borderColor: "#4ade80" }]}>
      <Text style={[s.pillText, done && { color: "#4ade80" }]}>{status}</Text>
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
  hi: { color: C.muted, fontSize: 14, paddingHorizontal: 16, marginTop: 2, marginBottom: 12 },
  notif: {
    backgroundColor: "rgba(56,189,248,0.08)",
    borderColor: C.sky,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  notifTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  notifTitle: { color: C.sky, fontWeight: "700", fontSize: 15 },
  markRead: { color: C.muted, fontSize: 13, fontWeight: "600" },
  notifLine: { color: C.text, fontSize: 14, paddingVertical: 3 },
  card: {
    backgroundColor: C.card,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  ref: { fontSize: 19, fontWeight: "800", color: C.text, letterSpacing: 0.5 },
  route: { fontSize: 16, color: C.text },
  meta: { color: C.muted, fontSize: 13, marginTop: 6 },
  empty: { color: C.muted, textAlign: "center", marginTop: 40 },
  pill: {
    backgroundColor: "rgba(56,189,248,0.12)",
    borderColor: C.sky,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  pillText: { color: C.sky, fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  locLive: {
    backgroundColor: "rgba(74,222,128,0.12)",
    borderColor: "#4ade80",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  locLiveText: { color: "#4ade80", fontSize: 10.5, fontWeight: "700" },
  locOff: {
    backgroundColor: "rgba(148,170,205,0.10)",
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  locOffText: { color: C.muted, fontSize: 10.5, fontWeight: "700" },
});
