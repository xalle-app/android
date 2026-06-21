import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator,
  ScrollView, StatusBar,
} from "react-native";
import { API_BASE, ACCENT, BG, INK, INK_SOFT, LINE, SURFACE } from "../config.js";
import { useAuthStore } from "../store/auth.js";

export default function AuthScreen({ navigation }) {
  const [tab, setTab]           = useState("login");
  const [handle, setHandle]     = useState("");
  const [password, setPass]     = useState("");
  const [name, setName]         = useState("");
  const [error, setError]       = useState(null);
  const [busy, setBusy]         = useState(false);
  const [stage, setStage]       = useState("form");
  const [emailHint, setEmailHint] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const login = useAuthStore(s => s.login);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (stage === "email2fa") {
        const h = handle.trim().replace(/^@/, "");
        const p = password.trim();
        const res = await fetch(`${API_BASE}/api/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ handle: h, password: p, emailCode: emailCode.trim() }),
        });
        const data = await res.json();
        if (!res.ok) { setError(data.error || "Неверный код"); return; }
        await login(data.token, data.user);
        return;
      }

      const h = handle.trim().replace(/^@/, "");
      const p = password.trim();
      if (!h || !p) { setError("Заполни все поля"); return; }
      if (tab === "register" && !name.trim()) { setError("Введи имя"); return; }

      const url = `${API_BASE}/api/${tab === "login" ? "login" : "register"}`;
      const body = tab === "login"
        ? { handle: h, password: p }
        : { handle: h, password: p, name: name.trim() };

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.status === 206 && data.needEmail2fa) {
        setEmailHint(data.emailHint || "");
        setEmailCode("");
        setStage("email2fa");
        return;
      }
      if (!res.ok) {
        setError(data.error || (tab === "login" ? "Ошибка входа" : "Ошибка регистрации"));
        return;
      }
      await login(data.token, data.user);
    } catch (e) {
      setError("Нет соединения с сервером");
    } finally {
      setBusy(false);
    }
  };

  const backToForm = () => { setStage("form"); setEmailCode(""); setError(null); };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

        {/* Logo */}
        <View style={styles.logoWrap}>
          <Text style={styles.logo}>Xalle</Text>
          <Text style={styles.logoSub}>тёплая лента</Text>
        </View>

        {stage === "email2fa" ? (
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Text style={styles.iconEmoji}>✉️</Text>
            </View>
            <Text style={styles.twoFaTitle}>Код подтверждения</Text>
            <Text style={styles.twoFaHint}>
              Мы отправили 6-значный код на {emailHint}
            </Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="000000"
              placeholderTextColor={INK_SOFT}
              value={emailCode}
              onChangeText={t => setEmailCode(t.replace(/\D/g, "").slice(0, 6))}
              keyboardType="number-pad"
              autoFocus
              maxLength={6}
              textAlign="center"
            />
            {error && <Text style={styles.error}>{error}</Text>}
            <TouchableOpacity
              style={[styles.btn, (busy || emailCode.length < 6) && styles.btnDisabled]}
              onPress={submit} disabled={busy || emailCode.length < 6} activeOpacity={0.8}
            >
              {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Подтвердить</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={backToForm} style={styles.backBtn}>
              <Text style={styles.backText}>← Назад</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {/* Tabs */}
            <View style={styles.tabs}>
              <TouchableOpacity
                style={[styles.tab, tab === "login" && styles.tabActive]}
                onPress={() => { setTab("login"); setError(null); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, tab === "login" && styles.tabTextActive]}>Вход</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, tab === "register" && styles.tabActive]}
                onPress={() => { setTab("register"); setError(null); }}
                activeOpacity={0.8}
              >
                <Text style={[styles.tabText, tab === "register" && styles.tabTextActive]}>Регистрация</Text>
              </TouchableOpacity>
            </View>

            {/* Form */}
            <View style={styles.card}>
              {tab === "register" && (
                <View style={styles.inputWrap}>
                  <Text style={styles.inputLabel}>Имя</Text>
                  <TextInput
                    style={styles.input} placeholder="Как тебя зовут?" placeholderTextColor={INK_SOFT}
                    value={name} onChangeText={setName} autoCorrect={false}
                  />
                </View>
              )}
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>Никнейм</Text>
                <TextInput
                  style={styles.input} placeholder="@username" placeholderTextColor={INK_SOFT}
                  value={handle} onChangeText={setHandle}
                  autoCapitalize="none" autoCorrect={false} autoComplete="username"
                />
              </View>
              <View style={styles.inputWrap}>
                <Text style={styles.inputLabel}>Пароль</Text>
                <TextInput
                  style={styles.input} placeholder="••••••••" placeholderTextColor={INK_SOFT}
                  value={password} onChangeText={setPass}
                  secureTextEntry autoComplete="password"
                />
              </View>

              {error && <Text style={styles.error}>{error}</Text>}

              <TouchableOpacity
                style={[styles.btn, busy && styles.btnDisabled]}
                onPress={submit} disabled={busy} activeOpacity={0.85}
              >
                {busy
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.btnText}>{tab === "login" ? "Войти" : "Создать аккаунт"}</Text>
                }
              </TouchableOpacity>

              {tab === "login" && (
                <TouchableOpacity onPress={() => navigation.navigate("ForgotPassword")} style={styles.forgotBtn}>
                  <Text style={styles.forgotText}>Забыл пароль?</Text>
                </TouchableOpacity>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1, backgroundColor: BG },
  scroll:        { flexGrow: 1, justifyContent: "center", padding: 24 },

  logoWrap:      { alignItems: "center", marginBottom: 40 },
  logo:          { fontSize: 52, fontWeight: "900", color: ACCENT, letterSpacing: -2, fontStyle: "italic" },
  logoSub:       { fontSize: 13, color: INK_SOFT, marginTop: 4, letterSpacing: 0.2 },

  tabs:          { flexDirection: "row", backgroundColor: SURFACE, borderRadius: 16, padding: 4, marginBottom: 14, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
  tab:           { flex: 1, paddingVertical: 11, borderRadius: 13, alignItems: "center" },
  tabActive:     { backgroundColor: ACCENT },
  tabText:       { fontSize: 14.5, fontWeight: "600", color: INK_SOFT },
  tabTextActive: { color: "#fff" },

  card:          { backgroundColor: SURFACE, borderRadius: 20, padding: 20, gap: 16, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 4 },

  inputWrap:     { gap: 6 },
  inputLabel:    { fontSize: 12, fontWeight: "700", color: INK_SOFT, textTransform: "uppercase", letterSpacing: 0.5, marginLeft: 2 },
  input:         { height: 50, borderRadius: 13, backgroundColor: "#f5f0ea", paddingHorizontal: 16, fontSize: 15.5, color: INK, borderWidth: 1, borderColor: LINE },

  error:         { fontSize: 13.5, color: "#e05a5a", textAlign: "center", fontWeight: "600" },
  btn:           { height: 52, backgroundColor: ACCENT, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 4, shadowColor: ACCENT, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  btnDisabled:   { opacity: 0.55, shadowOpacity: 0 },
  btnText:       { color: "#fff", fontSize: 16, fontWeight: "700" },

  iconCircle:    { width: 64, height: 64, borderRadius: 32, backgroundColor: `${ACCENT}15`, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  iconEmoji:     { fontSize: 28 },
  twoFaTitle:    { fontSize: 19, fontWeight: "800", color: INK, textAlign: "center" },
  twoFaHint:     { fontSize: 14, color: INK_SOFT, textAlign: "center", lineHeight: 21 },
  codeInput:     { fontSize: 30, fontWeight: "700", letterSpacing: 10, height: 64, textAlign: "center" },
  backBtn:       { alignItems: "center", paddingTop: 2 },
  backText:      { fontSize: 14, color: ACCENT, fontWeight: "600" },
  forgotBtn:     { alignItems: "center", marginTop: -4 },
  forgotText:    { fontSize: 13.5, color: ACCENT, fontWeight: "600" },
});
