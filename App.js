import { useEffect, useState, useCallback } from "react";
import { View, Text, ActivityIndicator, TouchableOpacity, StyleSheet } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import Feather from "@expo/vector-icons/Feather";
import { useAuthStore } from "./src/store/auth.js";
import AppNavigator, { navigationRef } from "./src/navigation/index.jsx";
import { ws, wsOn } from "./src/lib/ws.js";
import { usePushToken } from "./src/lib/usePushToken.js";
import { useUnreadStore } from "./src/store/unread.js";
import { useTheme } from "./src/store/theme.js";
import { api } from "./src/lib/api.js";

function LockScreen({ onUnlock }) {
  const c = useTheme();
  const [error, setError] = useState("");
  const [busy, setBusy]   = useState(false);

  const tryUnlock = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Войди в Xalle",
        cancelLabel: "Отмена",
        fallbackLabel: "Использовать пароль",
      });
      if (result.success) {
        onUnlock();
      } else {
        setError("Не удалось подтвердить личность");
      }
    } catch {
      setError("Ошибка биометрии");
    } finally { setBusy(false); }
  }, [onUnlock]);

  useEffect(() => { tryUnlock(); }, []);

  return (
    <View style={[ls.root, { backgroundColor: c.BG }]}>
      <View style={[ls.icon, { backgroundColor: `${c.ACCENT}15` }]}>
        <Feather name="lock" size={38} color={c.ACCENT} />
      </View>
      <Text style={[ls.title, { color: c.INK }]}>Xalle заблокирован</Text>
      <Text style={[ls.sub, { color: c.INK_SOFT }]}>Подтверди отпечаток для входа</Text>
      {!!error && <Text style={[ls.error, { color: "#e05a5a" }]}>{error}</Text>}
      <TouchableOpacity
        style={[ls.btn, { backgroundColor: c.ACCENT }]}
        onPress={tryUnlock}
        disabled={busy}
        activeOpacity={0.85}
      >
        {busy
          ? <ActivityIndicator color="#fff" size="small" />
          : <><Feather name="cpu" size={16} color="#fff" /><Text style={ls.btnText}>Разблокировать</Text></>
        }
      </TouchableOpacity>
    </View>
  );
}

const ls = StyleSheet.create({
  root:    { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, paddingHorizontal: 40 },
  icon:    { width: 80, height: 80, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  title:   { fontSize: 22, fontWeight: "800" },
  sub:     { fontSize: 15, textAlign: "center" },
  error:   { fontSize: 13.5, textAlign: "center" },
  btn:     { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16, marginTop: 8 },
  btnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

export default function App() {
  const { init, ready } = useAuthStore();
  const token = useAuthStore(s => s.token);
  const c = useTheme();

  const [locked, setLocked] = useState(null); // null = checking, false = unlocked, true = locked

  useEffect(() => { init(); }, []);

  // Check biometric lock after session loads
  useEffect(() => {
    if (!ready) return;
    if (!token) { setLocked(false); return; }

    (async () => {
      try {
        const bioEnabled = await SecureStore.getItemAsync("bio_lock");
        if (bioEnabled !== "1") { setLocked(false); return; }
        const hasHW  = await LocalAuthentication.hasHardwareAsync();
        const enrolled = hasHW && await LocalAuthentication.isEnrolledAsync();
        setLocked(enrolled ? true : false);
      } catch { setLocked(false); }
    })();
  }, [ready, token]);

  useEffect(() => {
    if (token) {
      ws.connect(token);
      api("/notifications").then(list => {
        if (Array.isArray(list)) {
          useUnreadStore.getState().setNotifications(list.filter(n => !n.read).length);
        }
      }).catch(() => {});
    } else {
      ws.disconnect();
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    return wsOn("notif", () => {
      useUnreadStore.getState().incNotifications();
    });
  }, [token]);

  usePushToken(token, navigationRef);

  if (!ready || locked === null) {
    return (
      <View style={{ flex: 1, backgroundColor: c.BG, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="large" color={c.ACCENT} />
      </View>
    );
  }

  if (locked) {
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <LockScreen onUnlock={() => setLocked(false)} />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AppNavigator />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
