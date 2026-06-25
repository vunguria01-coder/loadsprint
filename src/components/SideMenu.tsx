import { useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Animated,
  Dimensions,
  Easing,
} from "react-native";
import { C } from "../config";

export type MenuKey = "loads" | "history" | "profile" | "settings";

const ITEMS: { key: MenuKey; label: string; icon: string }[] = [
  { key: "loads", label: "Loads", icon: "📦" },
  { key: "history", label: "History", icon: "🕘" },
  { key: "profile", label: "Profile", icon: "👤" },
  { key: "settings", label: "Settings", icon: "⚙️" },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "DR";
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}

export function SideMenu({
  visible,
  name,
  email,
  active,
  onSelect,
  onSignOut,
  onClose,
}: {
  visible: boolean;
  name: string;
  email: string;
  active: MenuKey;
  onSelect: (key: MenuKey) => void;
  onSignOut: () => void;
  onClose: () => void;
}) {
  const width = Math.min(310, Dimensions.get("window").width * 0.82);
  const slide = useRef(new Animated.Value(-width)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, {
        toValue: visible ? 0 : -width,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: visible ? 1 : 0,
        duration: 220,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, width, slide, fade]);

  // Keep it mounted only when needed (after close animation it stays at 0 opacity).
  if (!visible) {
    // Render nothing once fully hidden to avoid catching touches.
    return null;
  }

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <Animated.View style={[s.backdrop, { opacity: fade }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      </Animated.View>

      <Animated.View style={[s.drawer, { width, transform: [{ translateX: slide }] }]}>
        {/* Header: avatar + name + email */}
        <View style={s.head}>
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials(name)}</Text>
          </View>
          <Text style={s.name} numberOfLines={1}>
            {name || "Driver"}
          </Text>
          {!!email && (
            <Text style={s.email} numberOfLines={1}>
              {email}
            </Text>
          )}
        </View>

        {/* Items */}
        <View style={s.items}>
          {ITEMS.map((it) => {
            const isActive = it.key === active;
            return (
              <Pressable
                key={it.key}
                style={[s.item, isActive && s.itemActive]}
                onPress={() => {
                  onSelect(it.key);
                  onClose();
                }}
              >
                <Text style={s.itemIcon}>{it.icon}</Text>
                <Text style={[s.itemLabel, isActive && s.itemLabelActive]}>{it.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Sign out pinned to bottom */}
        <Pressable style={s.signout} onPress={onSignOut}>
          <Text style={s.itemIcon}>↩︎</Text>
          <Text style={s.signoutText}>Log out</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(5,9,18,0.6)" },
  drawer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: "#0d1626",
    borderRightWidth: 1,
    borderRightColor: C.line,
    paddingTop: 60,
    paddingBottom: 28,
  },
  head: { paddingHorizontal: 22, paddingBottom: 22, borderBottomWidth: 1, borderBottomColor: C.line },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: C.blue,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarText: { color: "#fff", fontSize: 20, fontWeight: "800" },
  name: { color: C.text, fontSize: 18, fontWeight: "800" },
  email: { color: C.muted, fontSize: 13, marginTop: 2 },
  items: { paddingTop: 14, paddingHorizontal: 12, flex: 1 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  itemActive: { backgroundColor: "rgba(56,189,248,0.10)" },
  itemIcon: { fontSize: 18, width: 24, textAlign: "center" },
  itemLabel: { color: C.muted, fontSize: 16, fontWeight: "600" },
  itemLabelActive: { color: C.sky },
  signout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginHorizontal: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderTopWidth: 1,
    borderTopColor: C.line,
  },
  signoutText: { color: "#fca5a5", fontSize: 16, fontWeight: "700" },
});
