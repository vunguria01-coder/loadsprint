import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { C } from "../config";
import { login, claimByCode, saveSession } from "../api";

type Mode = "login" | "claim";

export function LoginScreen({ onLoggedIn }: { onLoggedIn: (name: string, email: string) => void }) {
  const [mode, setMode] = useState<Mode>("login");

  // login fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // claim (register) fields
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [newPassword, setNewPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);

    if (mode === "login") {
      if (!email.trim() || !password) {
        setError("Enter your email and password.");
        return;
      }
      setBusy(true);
      const res = await login(email.trim(), password);
      setBusy(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      await saveSession(res.data.token, res.data.driver.name, res.data.driver.email);
      onLoggedIn(res.data.driver.name, res.data.driver.email);
    } else {
      if (!code.trim() || !name.trim() || newPassword.length < 6) {
        setError("Enter your code, name and a password (6+ characters).");
        return;
      }
      setBusy(true);
      const res = await claimByCode(code.trim(), name.trim(), newPassword);
      setBusy(false);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      await saveSession(res.data.token, res.data.driver.name, res.data.driver.email);
      onLoggedIn(res.data.driver.name, res.data.driver.email);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView contentContainerStyle={s.wrap} keyboardShouldPersistTaps="handled">
        <Text style={s.logo}>
          Load<Text style={{ color: C.sky }}>Sprint</Text>
        </Text>
        <Text style={s.sub}>Driver access</Text>

        {/* Tabs */}
        <View style={s.tabs}>
          <Pressable
            style={[s.tab, mode === "login" && s.tabActive]}
            onPress={() => {
              setMode("login");
              setError(null);
            }}
          >
            <Text style={[s.tabText, mode === "login" && s.tabTextActive]}>Sign in</Text>
          </Pressable>
          <Pressable
            style={[s.tab, mode === "claim" && s.tabActive]}
            onPress={() => {
              setMode("claim");
              setError(null);
            }}
          >
            <Text style={[s.tabText, mode === "claim" && s.tabTextActive]}>Register with code</Text>
          </Pressable>
        </View>

        {error && (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        )}

        {mode === "login" ? (
          <>
            <Text style={s.label}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@email.com"
              placeholderTextColor={C.muted}
              autoCapitalize="none"
              keyboardType="email-address"
              style={s.input}
            />
            <Text style={s.label}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Your password"
              placeholderTextColor={C.muted}
              secureTextEntry
              style={s.input}
            />
          </>
        ) : (
          <>
            <Text style={s.label}>Invite code</Text>
            <TextInput
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              placeholder="K7P2-9QXM"
              placeholderTextColor={C.muted}
              autoCapitalize="characters"
              style={s.input}
            />
            <Text style={s.label}>Your name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Full name"
              placeholderTextColor={C.muted}
              style={s.input}
            />
            <Text style={s.label}>Create a password</Text>
            <TextInput
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="6+ characters"
              placeholderTextColor={C.muted}
              secureTextEntry
              style={s.input}
            />
          </>
        )}

        <Pressable style={[s.btn, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.btnText}>{mode === "login" ? "Sign in" : "Create account"}</Text>
          )}
        </Pressable>

        <Text style={s.hint}>
          {mode === "login"
            ? "Use the driver account your dispatcher set up for you."
            : "Enter the one-time code your dispatcher sent you."}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  wrap: { flexGrow: 1, justifyContent: "center", padding: 24 },
  logo: { fontSize: 38, fontWeight: "800", color: C.text, textAlign: "center" },
  sub: { fontSize: 16, color: C.muted, textAlign: "center", marginTop: 6, marginBottom: 22 },
  tabs: {
    flexDirection: "row",
    backgroundColor: C.card,
    borderColor: C.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: 4,
    marginBottom: 18,
  },
  tab: { flex: 1, paddingVertical: 11, borderRadius: 9, alignItems: "center" },
  tabActive: { backgroundColor: C.blue },
  tabText: { color: C.muted, fontWeight: "700", fontSize: 14 },
  tabTextActive: { color: "#fff" },
  label: { color: C.muted, fontSize: 13, marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: "#0a1424",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    color: "#fff",
    fontSize: 16,
  },
  btn: {
    backgroundColor: C.blue,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 26,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  hint: { color: C.muted, fontSize: 13, textAlign: "center", marginTop: 20 },
  errorBox: {
    backgroundColor: "rgba(239,68,68,0.12)",
    borderColor: C.danger,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 4,
  },
  errorText: { color: "#fecaca", fontSize: 14 },
});
