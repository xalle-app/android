import { useState } from "react";
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, ActivityIndicator, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { api } from "../lib/api.js";
import { haptic } from "../lib/haptics.js";
import { useTheme } from "../store/theme.js";

const KINDS = [
  { id: "bug",   emoji: "🐞", label: "Баг" },
  { id: "idea",  emoji: "💡", label: "Идея" },
  { id: "other", emoji: "💬", label: "Другое" },
];

const BODY_HINTS = {
  bug:   "Что произошло? Что ожидалось? Шаги для воспроизведения...",
  idea:  "Опиши идею. Как это могло бы работать?",
  other: "Напиши всё, что хочешь передать команде...",
};

export default function FeedbackModal({ visible, onClose }) {
  const insets = useSafeAreaInsets();
  const c = useTheme();

  const [kind,  setKind]  = useState("bug");
  const [title, setTitle] = useState("");
  const [body,  setBody]  = useState("");
  const [where, setWhere] = useState("");
  const [busy,  setBusy]  = useState(false);

  const reset = () => { setKind("bug"); setTitle(""); setBody(""); setWhere(""); };

  const submit = async () => {
    if (!body.trim()) {
      Alert.alert("Ошибка", "Опиши проблему или идею");
      return;
    }
    setBusy(true);
    try {
      await api("/feedback", { method: "POST", body: { kind, title, body, where } });
      haptic.success();
      Alert.alert("Спасибо!", "Сообщение отправлено команде Xalle");
      reset();
      onClose();
    } catch (e) {
      Alert.alert("Ошибка", e.message || "Не удалось отправить");
    } finally { setBusy(false); }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={[st.root, { backgroundColor: c.BG }]}>
        {/* Header */}
        <View style={[st.header, { paddingTop: insets.top + 8, backgroundColor: c.SURFACE, borderBottomColor: c.LINE }]}>
          <TouchableOpacity onPress={onClose} style={st.closeBtn} activeOpacity={0.7}>
            <Feather name="x" size={22} color={c.INK_SOFT} />
          </TouchableOpacity>
          <Text style={[st.title, { color: c.INK }]}>Обратная связь</Text>
          <TouchableOpacity
            onPress={submit}
            disabled={busy || !body.trim()}
            style={[st.sendBtn, { backgroundColor: body.trim() && !busy ? c.ACCENT : `${c.ACCENT}40` }]}
            activeOpacity={0.8}
          >
            {busy
              ? <ActivityIndicator color="#fff" size="small" />
              : <Text style={st.sendText}>Отправить</Text>
            }
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={[st.body, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
          {/* Kind selector */}
          <View style={st.sectionLabel}>
            <Text style={[st.label, { color: c.INK_SOFT }]}>Тип</Text>
          </View>
          <View style={[st.kindRow, { backgroundColor: c.SURFACE }]}>
            {KINDS.map(k => (
              <TouchableOpacity
                key={k.id}
                style={[st.kindBtn, kind === k.id && { backgroundColor: `${c.ACCENT}15`, borderColor: c.ACCENT }]}
                onPress={() => setKind(k.id)}
                activeOpacity={0.8}
              >
                <Text style={st.kindEmoji}>{k.emoji}</Text>
                <Text style={[st.kindLabel, { color: kind === k.id ? c.ACCENT : c.INK }]}>{k.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Title */}
          <Text style={[st.label, { color: c.INK_SOFT, marginTop: 20 }]}>Заголовок (необязательно)</Text>
          <TextInput
            style={[st.input, { backgroundColor: c.SURFACE, color: c.INK, borderColor: c.LINE }]}
            placeholder="Краткое описание..."
            placeholderTextColor={c.INK_SOFT}
            value={title}
            onChangeText={setTitle}
            maxLength={120}
          />

          {/* Body */}
          <Text style={[st.label, { color: c.INK_SOFT, marginTop: 16 }]}>Описание *</Text>
          <TextInput
            style={[st.input, st.textArea, { backgroundColor: c.SURFACE, color: c.INK, borderColor: c.LINE }]}
            placeholder={BODY_HINTS[kind]}
            placeholderTextColor={c.INK_SOFT}
            value={body}
            onChangeText={setBody}
            multiline
            maxLength={3000}
            textAlignVertical="top"
          />

          {/* Where */}
          {kind === "bug" && (
            <>
              <Text style={[st.label, { color: c.INK_SOFT, marginTop: 16 }]}>Где это произошло?</Text>
              <TextInput
                style={[st.input, { backgroundColor: c.SURFACE, color: c.INK, borderColor: c.LINE }]}
                placeholder="Экран, раздел, функция..."
                placeholderTextColor={c.INK_SOFT}
                value={where}
                onChangeText={setWhere}
                maxLength={200}
              />
            </>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const st = StyleSheet.create({
  root:       { flex: 1 },
  header:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  closeBtn:   { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title:      { fontSize: 17, fontWeight: "800" },
  sendBtn:    { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  sendText:   { color: "#fff", fontWeight: "700", fontSize: 14 },
  body:       { padding: 16 },
  sectionLabel: { marginBottom: 10 },
  label:      { fontSize: 13, fontWeight: "600", marginBottom: 8 },
  kindRow:    { flexDirection: "row", gap: 10, padding: 12, borderRadius: 16 },
  kindBtn:    { flex: 1, alignItems: "center", gap: 4, padding: 12, borderRadius: 12, borderWidth: 1.5, borderColor: "transparent" },
  kindEmoji:  { fontSize: 22 },
  kindLabel:  { fontSize: 13, fontWeight: "600" },
  input:      { borderRadius: 12, padding: 13, fontSize: 14.5, borderWidth: 1, marginBottom: 4 },
  textArea:   { minHeight: 120, textAlignVertical: "top" },
});
