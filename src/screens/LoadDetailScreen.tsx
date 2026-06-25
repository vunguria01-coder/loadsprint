import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  TextInput,
  Image,
  ActivityIndicator,
  Linking,
  Alert,
  Switch,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { C } from "../config";
import { getLoad, actOnLoad, postDriverLocation, buildRoute, type LoadDetail, type TruckRoute } from "../api";
import { navigateTo, navigateRoute, navigateTruck } from "../nav";
import { Pill } from "./LoadsScreen";

const STATUSES = ["Assigned", "Picked Up", "In Transit", "At Delivery", "Delivered", "Closed"];

export function LoadDetailScreen({ loadId, onBack }: { loadId: string; onBack: () => void }) {
  const [load, setLoad] = useState<LoadDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [route, setRoute] = useState<TruckRoute | null>(null);
  const [routing, setRouting] = useState(false);
  const polling = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchLoad = useCallback(async () => {
    const res = await getLoad(loadId);
    if (res.ok) setLoad(res.data.load);
  }, [loadId]);

  useEffect(() => {
    fetchLoad();
    polling.current = setInterval(fetchLoad, 6000);
    return () => {
      if (polling.current) clearInterval(polling.current);
    };
  }, [fetchLoad]);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    const res = await actOnLoad(loadId, body);
    setBusy(false);
    if (res.ok) setLoad(res.data.load);
    else Alert.alert("Could not save", res.error);
  }

  // Driver's own location-sharing toggle (default ON when undefined).
  const sharing = load ? load.driverShareLocation !== false : false;

  // While this screen is open and sharing is ON, send real GPS to the dispatcher.
  useEffect(() => {
    if (!load || !sharing) return;
    let active = true;
    let timer: ReturnType<typeof setInterval> | null = null;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (!active) return;
      if (status !== "granted") {
        // Permission denied — turn sharing off honestly and tell the driver.
        await actOnLoad(loadId, { action: "driver_share", value: false });
        fetchLoad();
        Alert.alert("Location off", "Location permission was denied, so sharing is turned off.");
        return;
      }
      async function pushOnce() {
        try {
          const pos = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          if (!active) return;
          await postDriverLocation(loadId, pos.coords.latitude, pos.coords.longitude);
        } catch {
          /* ignore a single failed fix */
        }
      }
      await pushOnce();
      timer = setInterval(pushOnce, 20000); // every 20s while open
    })();

    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [loadId, sharing, load === null, fetchLoad]);

  async function toggleShare(value: boolean) {
    if (value) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission needed", "Allow location access to share your position.");
        return;
      }
    }
    await act({ action: "driver_share", value });
  }

  async function makeRoute() {
    setRouting(true);
    const res = await buildRoute(loadId);
    setRouting(false);
    if (res.ok) {
      setRoute(res.data.route);
      setLoad(res.data.load);
    } else {
      Alert.alert("Routing unavailable", res.error);
    }
  }

  function fmtMiles(m: number) {
    return `${(m / 1609.34).toFixed(0)} mi`;
  }
  function fmtDuration(sec: number) {
    const h = Math.floor(sec / 3600);
    const m = Math.round((sec % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  async function takePhoto(kind: "photo" | "pod") {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Camera needed", "Allow camera access in Settings to take photos.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.6,
      base64: true,
    });
    if (result.canceled || !result.assets?.[0]?.base64) return;
    const dataUrl = `data:image/jpeg;base64,${result.assets[0].base64}`;
    if (kind === "photo") {
      await act({ action: "photo", phase: "in_transit", dataUrl });
    } else {
      await act({ action: "document", docType: "pod", name: "POD.jpg", dataUrl });
      await act({ action: "status", status: "Delivered" });
    }
  }

  function openDoc(dataUrl: string) {
    // PDFs/images are data URLs. Linking can open them in the system viewer.
    Linking.openURL(dataUrl).catch(() =>
      Alert.alert("Cannot open", "This file type can't be opened directly.")
    );
  }

  if (!load) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: "center" }}>
        <ActivityIndicator color={C.sky} />
      </View>
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 48 }}>
      <Pressable onPress={onBack} hitSlop={10}>
        <Text style={s.back}>‹ My loads</Text>
      </Pressable>

      <Text style={s.ref}>{load.ref}</Text>
      <Text style={s.route}>
        {load.originName} → {load.destName}
      </Text>
      <View style={{ marginTop: 8, alignSelf: "flex-start" }}>
        <Pill status={load.status} />
      </View>

      {/* Location sharing */}
      <Section title="Location sharing" />
      <View style={s.shareBox}>
        <View style={{ flex: 1, paddingRight: 12 }}>
          <Text style={s.shareTitle}>
            {sharing ? "📍 Sharing my location" : "🔒 Location hidden"}
          </Text>
          <Text style={s.shareHint}>
            {sharing
              ? "Your dispatcher sees your live position while the app is open."
              : "Your dispatcher sees your last known point, marked as paused."}
          </Text>
        </View>
        <Switch
          value={sharing}
          onValueChange={toggleShare}
          trackColor={{ true: C.green, false: "#33415a" }}
          thumbColor="#fff"
        />
      </View>

      {/* Navigation */}
      <Section title="Navigation" />
      <Pressable style={[s.navBtn, { backgroundColor: C.blue }]} onPress={() => navigateTo(load.originName)}>
        <Text style={s.navBtnText}>🧭 Navigate to pickup</Text>
      </Pressable>
      <Pressable style={[s.navBtn, { backgroundColor: C.blue }]} onPress={() => navigateTo(load.destName)}>
        <Text style={s.navBtnText}>🧭 Navigate to delivery</Text>
      </Pressable>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Pressable style={[s.navBtn, s.navGhost, { flex: 1 }]} onPress={() => navigateRoute(load.originName, load.destName)}>
          <Text style={s.navGhostText}>Full route</Text>
        </Pressable>
        <Pressable style={[s.navBtn, s.navGhost, { flex: 1 }]} onPress={() => navigateTruck(load.destName)}>
          <Text style={s.navGhostText}>🚛 Truck app</Text>
        </Pressable>
      </View>
      <Text style={s.smallMuted}>
        “Truck app” opens Trucker Path (truck-legal routing) if installed, otherwise Maps.
      </Text>

      {/* Built-in truck navigator (HERE) */}
      <Section title="Truck route (LoadSprint)" />
      <Pressable
        style={[s.bigBtn, { backgroundColor: C.sky }]}
        disabled={routing}
        onPress={makeRoute}
      >
        <Text style={[s.bigBtnText, { color: "#06283d" }]}>
          {routing ? "Building route…" : "🚛 Build truck route to delivery"}
        </Text>
      </Pressable>

      {(route || typeof load.remainingMeters === "number") && (
        <View style={s.routeCard}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
            <Text style={s.routeBig}>
              {fmtMiles(route ? route.distanceMeters : load.remainingMeters || 0)}
            </Text>
            <Text style={s.routeEta}>
              ETA{" "}
              {new Date(
                Date.now() + (route ? route.durationSeconds : load.etaSeconds || 0) * 1000
              ).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              {"  ·  "}
              {fmtDuration(route ? route.durationSeconds : load.etaSeconds || 0)}
            </Text>
          </View>
          <Text style={s.routeHint}>Truck-legal route to {load.destName}.</Text>

          {route && route.steps.length > 0 && (
            <View style={{ marginTop: 12 }}>
              {route.steps.slice(0, 40).map((st, idx) => (
                <View key={idx} style={s.stepRow}>
                  <Text style={s.stepNum}>{idx + 1}</Text>
                  <Text style={s.stepText}>{st.text}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Documents */}
      <Section title="Files from dispatcher" />
      {load.documents.length === 0 ? (
        <Muted>No files yet.</Muted>
      ) : (
        load.documents.map((d) => (
          <View key={d.id} style={s.docRow}>
            <Text style={s.docName}>📄 {d.name}</Text>
            <Pressable style={s.openBtn} onPress={() => openDoc(d.dataUrl)}>
              <Text style={s.openBtnText}>Open</Text>
            </Pressable>
          </View>
        ))
      )}

      {/* Photo */}
      <Section title="Cargo photo" />
      <Pressable style={[s.bigBtn, { backgroundColor: C.blue }]} disabled={busy} onPress={() => takePhoto("photo")}>
        <Text style={s.bigBtnText}>📷 Take & send photo</Text>
      </Pressable>
      {load.photos.length > 0 && (
        <View style={s.photoGrid}>
          {load.photos.map((p) => (
            <Image key={p.id} source={{ uri: p.dataUrl }} style={s.thumb} />
          ))}
        </View>
      )}

      {/* Status */}
      <Section title="Update status" />
      <View style={s.statusWrap}>
        {STATUSES.map((st) => {
          const active = load.status === st;
          return (
            <Pressable
              key={st}
              disabled={busy}
              onPress={() => act({ action: "status", status: st })}
              style={[s.statusChip, { borderColor: active ? C.blue : C.line, backgroundColor: active ? C.blue : C.card }]}
            >
              <Text style={{ color: active ? "#fff" : C.muted, fontWeight: "600", fontSize: 14 }}>{st}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* POD */}
      <Section title="Close out delivery" />
      <Pressable style={[s.bigBtn, { backgroundColor: C.green }]} disabled={busy} onPress={() => takePhoto("pod")}>
        <Text style={s.bigBtnText}>✓ Delivered + photo of paperwork (POD)</Text>
      </Pressable>

      {/* Chat */}
      <Section title="Chat with dispatcher" />
      <View style={s.chatBox}>
        {load.messages.length === 0 ? (
          <Muted>No messages yet.</Muted>
        ) : (
          load.messages.map((m) => (
            <View key={m.id} style={{ marginBottom: 10 }}>
              <Text style={s.chatMeta}>
                {m.authorName} · {m.authorRole}
              </Text>
              {!!m.text && <Text style={s.chatText}>{m.text}</Text>}
            </View>
          ))
        )}
      </View>
      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        <TextInput
          value={msg}
          onChangeText={setMsg}
          placeholder="Message…"
          placeholderTextColor={C.muted}
          style={s.chatInput}
        />
        <Pressable
          style={s.sendBtn}
          disabled={busy || !msg.trim()}
          onPress={async () => {
            const t = msg.trim();
            if (!t) return;
            setMsg("");
            await act({ action: "message", text: t });
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "700" }}>Send</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Section({ title }: { title: string }) {
  return <Text style={s.section}>{title}</Text>;
}
function Muted({ children }: { children: React.ReactNode }) {
  return <Text style={{ color: C.muted, fontSize: 14 }}>{children}</Text>;
}

const s = StyleSheet.create({
  back: { color: C.sky, fontSize: 16, fontWeight: "600", marginBottom: 10 },
  shareBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: C.card,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  shareTitle: { color: C.text, fontSize: 15, fontWeight: "700" },
  shareHint: { color: C.muted, fontSize: 13, marginTop: 4, lineHeight: 18 },
  ref: { fontSize: 22, fontWeight: "800", color: C.text },
  route: { fontSize: 16, color: C.text, marginTop: 4 },
  section: { fontWeight: "700", fontSize: 15, marginTop: 26, marginBottom: 10, color: "#fff" },
  navBtn: { borderRadius: 12, paddingVertical: 14, alignItems: "center", marginBottom: 8 },
  navBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  navGhost: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  navGhostText: { color: C.text, fontWeight: "700", fontSize: 15 },
  smallMuted: { color: C.muted, fontSize: 12, lineHeight: 17, marginTop: 2 },
  routeCard: {
    backgroundColor: C.card,
    borderColor: "rgba(56,189,248,0.3)",
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    marginTop: 12,
  },
  routeBig: { color: C.sky, fontSize: 22, fontWeight: "800" },
  routeEta: { color: C.text, fontSize: 14, fontWeight: "700", textAlign: "right", flexShrink: 1 },
  routeHint: { color: C.muted, fontSize: 13 },
  stepRow: { flexDirection: "row", gap: 10, paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  stepNum: { color: C.sky, fontWeight: "800", fontSize: 13, width: 22 },
  stepText: { color: C.text, fontSize: 14, flex: 1, lineHeight: 19 },
  docRow: {
    backgroundColor: C.card,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  docName: { color: C.text, fontSize: 15, fontWeight: "600", flexShrink: 1 },
  openBtn: { backgroundColor: C.blue, borderRadius: 9, paddingHorizontal: 16, paddingVertical: 9 },
  openBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  bigBtn: { borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  bigBtnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  thumb: { width: 92, height: 92, borderRadius: 10, borderWidth: 1, borderColor: C.line },
  statusWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 11 },
  chatBox: {
    backgroundColor: C.card,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    maxHeight: 240,
  },
  chatMeta: { fontSize: 12, color: C.muted },
  chatText: { fontSize: 15, color: C.text },
  chatInput: {
    flex: 1,
    backgroundColor: "#0a1424",
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#fff",
    fontSize: 15,
  },
  sendBtn: { backgroundColor: C.blue, borderRadius: 12, paddingHorizontal: 18, justifyContent: "center" },
});
