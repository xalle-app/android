import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView, StatusBar,
} from "react-native";
import { API_BASE, ACCENT, BG, INK, INK_SOFT, LINE, SURFACE } from "../config.js";

export default function ForgotPasswordScreen({ navigation }) {
  const [stage, setStage]     = useState("request"); // request | code
  const [ident, setIdent]     = useState("");
  const [code, setCode]       = useState("");
  const [password, setPass]   = useState("");
  const [passConf, setConf]   = useState("");
  const [error, setError]     = useState(null);
  const [busy, setBusy]       = useState(false);
  const [success, setSuccess] = useState(false);

  const requestReset = async () => {
    const id = ident.trim().replace(/^@/, "");
    if (!id) { setError("Введи никнейм или email"); return; }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id.includes("@") ? { email: id } : { handle: id }),
      });
      await res.json();
      setStage("code");
    } catch {
      setError("Нет соединения с сервером");
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (code.length < 6) { setError("Введи 6-значный код из письма"); return; }
    if (password.length < 6) { setError("Пароль минимум 6 символов"); return; }
    if (password !== passConf) { setError("Пароли не совпадают"); return; }
    const id = ident.trim().replace(/^@/, "");
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          id.includes("@")
            ? { email: id, code: code.trim(), password }
            : { handle: id, code: code.trim(), password }
        ),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Ошибка сброса"); return; }
      setSuccess(true);
    } catch {
      setError("Нет соединения с сервером");
    } finally {
      setBusy(false);
    }
  };

  if (success) {
    return (
      <View style={[st.root, st.center]}>
        <StatusBar barStyle="dark-content" backgroundColor={BG} />
        <View style={st.iconCircle}>
          <Text style={st.iconEmoji}>✅</Text>
        </View>
        <Text style={st.title}>Пароль изменён</Text>
        <Text style={st.hint}>Теперь войди с новым паролем</Text>
        <TouchableOpacity style={st.btn} onPress={() => navigation.goBack()} activeOpacity={0.85}>
          <Text style={st.btnText}>Войти</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={st.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor={BG} />
      <ScrollView contentContainerStyle={st.scroll} keyboardShouldPersistTaps="handled">

        <View style={st.iconCircle}>
          <Text style={st.iconEmoji}>{stage === "request" ? "🔑" : "✉️"}</Text>
        </View>

        <Text style={st.title}>
          {stage === "request" ? "Восстановление пароля" : "Введи код и новый пароль"}
        </Text>
        <Text style={st.hint}>
          {stage === "request"
            ? "Укажи никнейм или привязанный email — мы пришлём код сброса"
            : `Проверь почту привязанную к аккаунту — там 6-значный код`}
        </Text>

        <View style={st.card}>
          {stage === "request" ? (
            <View style={st.inputWrap}>
              <Text style={st.label}>Никнейм или Email</Text>
              <TextInput
                style={st.input}
                placeholder="@username или mail@example.com"
                placeholderTextColor={INK_SOFT}
                value={ident}
                onChangeText={setIdent}
                autoCapitalize="none"
                autoCorrect={false}
                autoFocus
                keyboardType="email-address"
              />
            </View>
          ) : (
            <>
              <View style={st.inputWrap}>
                <Text style={st.label}>Код из письма</Text>
                <TextInput
                  style={[st.input, st.codeInput]}
                  placeholder="000000"
                  placeholderTextColor={INK_SOFT}
                  value={code}
                  onChangeText={t => setCode(t.replace(/\D/g, "").slice(0, 6))}
                  keyboardType="number-pad"
                  autoFocus
                  maxLength={6}
                  textAlign="center"
                />
              </View>
              <View style={st.inputWrap}>
                <Text style={st.label}>Новый пароль</Text>
                <TextInput
                  style={st.input}
                  placeholder="Минимум 6 символов"
                  placeholderTextColor={INK_SOFT}
                  value={password}
                  onChangeText={setPass}
                  secureTextEntry
                  autoComplete="new-password"
                />
              </View>
              <View style={st.inputWrap}>
                <Text style={st.label}>Повтори пароль</Text>
                <TextInput
                  style={st.input}
                  placeholder="Ещё раз"
                  placeholderTextColor={INK_SOFT}
                  value={passConf}
                  onChangeText={setConf}
                  secureTextEntry
                />
              </View>
            </>
          )}

          {error && <Text style={st.error}>{error}</Text>}

          <TouchableOpacity
            style={[st.btn, busy && st.btnDisabled]}
            onPress={stage === "request" ? requestReset : resetPassword}
            disabled={busy}
            activeOpacity={0.85}
          >
            {busy
              ? <ActivityIndicator color="#fff" />
              : <Text style={st.btnText}>
                  {stage === "request" ? "Отправить код" : "Сменить пароль"}
                </Text>
            }
          </TouchableOpacity>

          {stage === "code" && (
            <TouchableOpacity
              style={st.linkBtn}
              onPress={() => { setStage("request"); setCode(""); setError(null); }}
            >
              <Text style={st.linkText}>← Назад</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={st.linkBtn} onPress={() => navigation.goBack()}>
          <Text style={st.linkText}>Вернуться ко входу</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  root:       { flex: 1, backgroundColor: BG },
  center:     { alignItems: "center", justifyContent: "center", gap: 16, padding: 32 },
  scroll:     { flexGrow: 1, justifyContent: "center", padding: 24, gap: 16 },

  iconCircle: { width: 72, height: 72, borderRadius: 36, backgroundColor: `${ACCENT}15`, alignItems: "center", justifyContent: "center", alignSelf: "center" },
  iconEmoji:  { fontSize: 32 },

  title:      { fontSize: 22, fontWeight: "800", color: INK, textAlign: "center", letterSpacing: -0.3 },
  hint:       { fontSize: 14, color: INK_SOFT, textAlign: "center", lineHeight: 21 },

  card:       { backgroundColor: SURFACE, borderRadius: 20, padding: 20, gap: 16, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  inputWrap:  { gap: 6 },
  label:      { fontSize: 12, fontWeight: "700", color: INK_SOFT, textTransform: "uppercase", letterSpacing: 0.5, marginLeft: 2 },
  input:      { height: 50, borderRadius: 13, backgroundColor: "#f5f0ea", paddingHorizontal: 16, fontSize: 15.5, color: INK, borderWidth: 1, borderColor: LINE },
  codeInput:  { fontSize: 28, fontWeight: "700", letterSpacing: 8, height: 64 },

  error:      { fontSize: 13.5, color: "#e05a5a", textAlign: "center", fontWeight: "600" },
  btn:        { height: 52, backgroundColor: ACCENT, borderRadius: 16, alignItems: "center", justifyContent: "center", shadowColor: ACCENT, shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  btnDisabled:{ opacity: 0.55, shadowOpacity: 0 },
  btnText:    { color: "#fff", fontSize: 16, fontWeight: "700" },

  linkBtn:    { alignItems: "center", paddingVertical: 4 },
  linkText:   { fontSize: 14, color: ACCENT, fontWeight: "600" },
});
