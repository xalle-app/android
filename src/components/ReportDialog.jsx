import { useState, useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal, Animated, ActivityIndicator, PanResponder } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { api } from "../lib/api.js";
import { haptic } from "../lib/haptics.js";
import { useTheme } from "../store/theme.js";

const REASONS = [
  { key: "spam",          icon: "alert-octagon",  label: "Спам" },
  { key: "inappropriate", icon: "slash",           label: "Оскорбительный контент" },
  { key: "rules",         icon: "shield-off",      label: "Нарушение правил" },
  { key: "fraud",         icon: "user-x",          label: "Мошенничество" },
  { key: "hate",          icon: "alert-triangle",  label: "Разжигание ненависти" },
  { key: "other",         icon: "more-horizontal", label: "Другое" },
];

export default function ReportDialog({ visible, onClose, targetType, targetId }) {
  const c      = useTheme();
  const insets = useSafeAreaInsets();
  const anim   = useRef(new Animated.Value(0)).current;
  const [selected, setSelected] = useState(null);
  const [busy, setBusy]         = useState(false);
  const [done, setDone]         = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8,
      onPanResponderRelease: (_, g) => { if (g.dy > 60 || g.vy > 1) onClose(); },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      setSelected(null); setDone(false); setBusy(false);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 11 }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    }
  }, [visible]);

  const submit = async () => {
    if (!selected || busy) return;
    haptic.medium();
    setBusy(true);
    try {
      await api("/report", { method: "POST", body: { targetType, targetId, reason: selected } });
      setDone(true);
      haptic.success();
      setTimeout(() => onClose(), 1500);
    } catch {
      haptic.error();
    } finally { setBusy(false); }
  };

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] });
  const opacity    = anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.5, 1] });

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[st.backdrop, { opacity }]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
      </Animated.View>
      <Animated.View style={[st.sheet, { backgroundColor: c.SURFACE, paddingBottom: insets.bottom + 20, transform: [{ translateY }] }]} {...panResponder.panHandlers}>
        <View style={[st.handle, { backgroundColor: c.LINE }]} />

        {done ? (
          <View style={st.doneBox}>
            <View style={st.doneIcon}>
              <Feather name="check" size={28} color="#3db87a" />
            </View>
            <Text style={[st.doneTitle, { color: c.INK }]}>Жалоба отправлена</Text>
            <Text style={[st.doneSub, { color: c.INK_SOFT }]}>Мы рассмотрим её в ближайшее время</Text>
          </View>
        ) : (
          <>
            <Text style={[st.title, { color: c.INK }]}>Пожаловаться</Text>
            <Text style={[st.sub, { color: c.INK_SOFT }]}>Выбери причину жалобы</Text>

            <View style={st.reasons}>
              {REASONS.map(r => {
                const isActive = selected === r.key;
                return (
                  <TouchableOpacity
                    key={r.key}
                    style={[st.reasonRow, { backgroundColor: c.WARM }, isActive && { backgroundColor: `${c.ACCENT}0e`, borderColor: `${c.ACCENT}30`, borderWidth: 1 }]}
                    onPress={() => { setSelected(r.key); haptic.light(); }}
                    activeOpacity={0.75}
                  >
                    <View style={[st.reasonIcon, { backgroundColor: c.SURFACE }, isActive && { backgroundColor: `${c.ACCENT}18` }]}>
                      <Feather name={r.icon} size={16} color={isActive ? c.ACCENT : c.INK_SOFT} />
                    </View>
                    <Text style={[st.reasonLabel, { color: c.INK }, isActive && { color: c.ACCENT, fontWeight: "700" }]}>{r.label}</Text>
                    {isActive && <Feather name="check" size={16} color={c.ACCENT} />}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[st.submitBtn, { backgroundColor: c.ACCENT }, (!selected || busy) && st.submitBtnOff]}
              onPress={submit}
              disabled={!selected || busy}
              activeOpacity={0.85}
            >
              {busy
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={st.submitText}>Отправить жалобу</Text>
              }
            </TouchableOpacity>
          </>
        )}
      </Animated.View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop:      { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 10 },
  sheet:         { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingHorizontal: 20, zIndex: 20, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 24, elevation: 24 },
  handle:        { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 18 },
  title:         { fontSize: 18, fontWeight: "800", marginBottom: 4 },
  sub:           { fontSize: 14, marginBottom: 18 },
  reasons:       { gap: 4, marginBottom: 20 },
  reasonRow:     { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: "transparent" },
  reasonIcon:    { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  reasonLabel:   { flex: 1, fontSize: 15, fontWeight: "500" },
  submitBtn:     { borderRadius: 16, paddingVertical: 14, alignItems: "center" },
  submitBtnOff:  { opacity: 0.4 },
  submitText:    { color: "#fff", fontSize: 15, fontWeight: "700" },
  doneBox:       { alignItems: "center", paddingVertical: 24, gap: 10 },
  doneIcon:      { width: 64, height: 64, borderRadius: 32, backgroundColor: "#3db87a18", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  doneTitle:     { fontSize: 18, fontWeight: "800" },
  doneSub:       { fontSize: 14, textAlign: "center" },
});
