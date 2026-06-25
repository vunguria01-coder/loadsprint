import { useEffect, useState } from "react";
import { View, ActivityIndicator, BackHandler, SafeAreaView, StatusBar, Platform } from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { C } from "./src/config";
import { loadSession, clearSession } from "./src/api";
import { LoginScreen } from "./src/screens/LoginScreen";
import { LoadsScreen } from "./src/screens/LoadsScreen";
import { LoadDetailScreen } from "./src/screens/LoadDetailScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { SideMenu, type MenuKey } from "./src/components/SideMenu";

type Phase = "loading" | "login" | "app";

export default function App() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  const [section, setSection] = useState<MenuKey>("loads");
  const [openLoadId, setOpenLoadId] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  // Restore session on launch.
  useEffect(() => {
    (async () => {
      const session = await loadSession();
      if (session) {
        setName(session.name);
        setEmail(session.email);
        setPhase("app");
      } else {
        setPhase("login");
      }
    })();
  }, []);

  // Android hardware back: detail -> list; menu -> close; section other than loads -> loads.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (openLoadId) {
        setOpenLoadId(null);
        return true;
      }
      if (menuOpen) {
        setMenuOpen(false);
        return true;
      }
      if (section !== "loads") {
        setSection("loads");
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [openLoadId, menuOpen, section]);

  async function signOut() {
    await clearSession();
    setMenuOpen(false);
    setOpenLoadId(null);
    setSection("loads");
    setPhase("login");
  }

  function onLoggedIn(n: string, e: string) {
    setName(n);
    setEmail(e);
    setSection("loads");
    setPhase("app");
  }

  if (phase === "loading") {
    return (
      <SafeAreaView style={s.safe}>
        <ExpoStatusBar style="light" />
        <View style={{ flex: 1, justifyContent: "center" }}>
          <ActivityIndicator color={C.sky} />
        </View>
      </SafeAreaView>
    );
  }

  if (phase === "login") {
    return (
      <SafeAreaView style={s.safe}>
        <ExpoStatusBar style="light" />
        <LoginScreen onLoggedIn={onLoggedIn} />
      </SafeAreaView>
    );
  }

  // Signed in. Decide what fills the screen.
  let body: React.ReactNode;
  if (openLoadId) {
    body = <LoadDetailScreen loadId={openLoadId} onBack={() => setOpenLoadId(null)} />;
  } else if (section === "loads") {
    body = (
      <LoadsScreen
        name={name}
        mode="active"
        onOpenLoad={(id) => setOpenLoadId(id)}
        onOpenMenu={() => setMenuOpen(true)}
      />
    );
  } else if (section === "history") {
    body = (
      <LoadsScreen
        name={name}
        mode="history"
        onOpenLoad={(id) => setOpenLoadId(id)}
        onOpenMenu={() => setMenuOpen(true)}
      />
    );
  } else if (section === "profile") {
    body = <ProfileScreen name={name} email={email} onOpenMenu={() => setMenuOpen(true)} />;
  } else {
    body = <SettingsScreen onOpenMenu={() => setMenuOpen(true)} onSignOut={signOut} />;
  }

  return (
    <SafeAreaView style={s.safe}>
      <ExpoStatusBar style="light" />
      {body}
      <SideMenu
        visible={menuOpen}
        name={name}
        email={email}
        active={section}
        onSelect={(key) => {
          setOpenLoadId(null);
          setSection(key);
        }}
        onSignOut={signOut}
        onClose={() => setMenuOpen(false)}
      />
    </SafeAreaView>
  );
}

const s = {
  safe: {
    flex: 1,
    backgroundColor: C.bg,
    paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0,
  },
} as const;
