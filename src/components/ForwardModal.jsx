import { useState, useEffect, useRef } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Modal, Animated, ActivityIndicator, PanResponder, TextInput } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import Avatar from "./Avatar.jsx";
import { api } from "../lib/api.js";
import { haptic } from "../lib/haptics.js";
import { useTheme } from "../store/theme.js";

export default function ForwardModal({ visible, onClose, message }) {
  const c      = useTheme();
  const insets = useSafeAreaInsets();
  const anim   = useRef(new Animated.Value(0)).current;
  const [convs, setConvs]   = useState([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(null);
  const [sent, setSent]       = useState(new Set());
  const [search, setSearch]   = useState("");

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8,
      onPanResponderRelease: (_, g) => { if (g.dy > 60 || g.vy > 1) onClose(); },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      setSearch(""); setSent(new Set()); setSending(null);
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 11 }).start();
      setLoading(true);
      api("/messages").then(data => {
        setConvs(Array.isArray(data) ? data.filter(cv => !cv.is_self) : []);
      }).catch(() => {}).finally(() => setLoading(false));
    } else {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    }
  }, [visible]);

  const forward = async (conv) => {
    if (sent.has(conv.id) || sending === conv.id) return;
    haptic.medium();
    setSending(conv.id);
    try {
      const body = message?.body || "";
      const fwdFrom = message?.id;
      await api(`/messages/${conv.id}/send`, {
        method: "POST",
        body: { body, forwardedFromId: fwdFrom },
      });
      setSent(prev => new Set([...prev, conv.id]));
      haptic.success();
    } catch { haptic.error(); }
    finally { setSending(null); }
  };

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [500, 0] });
  const opacity    = anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.5, 1] });

  const filtered = search.trim()
    ? convs.filter(cv => {
        const title  = (cv.other_name || cv.title || "").toLowerCase();
        const handle = (cv.other_handle || "").toLowerCase();
        const q = search.toLowerCase();
        return title.includes(q) || handle.includes(q);
      })
    : convs;

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[st.backdrop, { opacity }]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
      </Animated.View>
      <Animated.View style={[st.sheet, { backgroundColor: c.SURFACE, transform: [{ translateY }] }]} {...panResponder.panHandlers}>
        <View style={[st.handle, { backgroundColor: c.LINE }]} />
        <View style={st.titleRow}>
          <Text style={[st.title, { color: c.INK }]}>Переслать</Text>
          <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={st.closeBtn}>
            <Feather name="x" size={20} color={c.INK_SOFT} />
          </TouchableOpacity>
        </View>

        {!!message?.body && (
          <View style={[st.quoteBox, { backgroundColor: c.WARM, borderLeftColor: c.ACCENT }]}>
            <Text style={[st.quoteText, { color: c.INK }]} numberOfLines={2}>{message.body}</Text>
          </View>
        )}

        <View style={[st.searchWrap, { backgroundColor: c.WARM }]}>
          <Feather name="search" size={14} color={c.INK_SOFT} style={{ marginRight: 6 }} />
          <TextInput
            style={[st.searchInput, { color: c.INK }]}
            placeholder="Поиск диалога..."
            placeholderTextColor={c.INK_SOFT}
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {loading ? (
          <View style={st.center}><ActivityIndicator color={c.ACCENT} /></View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={cv => String(cv.id)}
            style={st.list}
            contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item: conv }) => {
              const title = conv.is_group ? (conv.title || "Группа") : (conv.other_name || conv.title);
              const sub   = conv.is_group ? `${conv.member_count || ""} участников` : `@${conv.other_handle || ""}`;
              const isSent    = sent.has(conv.id);
              const isSending = sending === conv.id;
              return (
                <TouchableOpacity
                  style={[st.convRow, isSent && st.convRowSent]}
                  onPress={() => forward(conv)}
                  activeOpacity={0.75}
                  disabled={isSent || isSending}
                >
                  <Avatar url={conv.other_avatar || conv.avatar_url} name={title} size={42} />
                  <View style={st.convInfo}>
                    <Text style={[st.convName, { color: c.INK }]} numberOfLines={1}>{title}</Text>
                    <Text style={[st.convSub, { color: c.INK_SOFT }]} numberOfLines={1}>{sub}</Text>
                  </View>
                  <View style={[st.sendBtn, { backgroundColor: `${c.ACCENT}15` }, isSent && st.sendBtnSent]}>
                    {isSending
                      ? <ActivityIndicator size="small" color={c.ACCENT} />
                      : <Feather name={isSent ? "check" : "send"} size={16} color={isSent ? "#3db87a" : c.ACCENT} />
                    }
                  </View>
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={
              <View style={st.empty}>
                <Feather name="inbox" size={28} color={c.INK_SOFT} style={{ opacity: 0.4, marginBottom: 8 }} />
                <Text style={[st.emptyText, { color: c.INK_SOFT }]}>Нет диалогов</Text>
              </View>
            }
          />
        )}
      </Animated.View>
    </Modal>
  );
}

const st = StyleSheet.create({
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)", zIndex: 10 },
  sheet:       { position: "absolute", bottom: 0, left: 0, right: 0, maxHeight: "80%", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, zIndex: 20, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 24, elevation: 24 },
  handle:      { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 10 },
  titleRow:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, marginBottom: 12 },
  title:       { flex: 1, fontSize: 18, fontWeight: "800" },
  closeBtn:    { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  quoteBox:    { marginHorizontal: 18, marginBottom: 12, borderRadius: 12, padding: 12, borderLeftWidth: 3 },
  quoteText:   { fontSize: 13.5, lineHeight: 20 },
  searchWrap:  { flexDirection: "row", alignItems: "center", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 18, marginBottom: 10 },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },
  list:        { flex: 1 },
  center:      { height: 120, alignItems: "center", justifyContent: "center" },
  convRow:     { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 10 },
  convRowSent: { opacity: 0.6 },
  convInfo:    { flex: 1 },
  convName:    { fontSize: 15, fontWeight: "700" },
  convSub:     { fontSize: 13, marginTop: 2 },
  sendBtn:     { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  sendBtnSent: { backgroundColor: "#3db87a18" },
  empty:       { alignItems: "center", paddingTop: 40 },
  emptyText:   { fontSize: 14 },
});
