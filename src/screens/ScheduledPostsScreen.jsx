import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { api } from "../lib/api.js";
import { haptic } from "../lib/haptics.js";
import { useTheme } from "../store/theme.js";

function fmtScheduled(str) {
  if (!str) return "—";
  try {
    const d = new Date(str);
    return d.toLocaleString("ru", {
      day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
    });
  } catch { return str; }
}

function PostCard({ post, onDelete, onPublishNow }) {
  const c = useTheme();
  const [busy, setBusy] = useState(false);

  const handleDelete = () => {
    Alert.alert("Удалить запланированный пост?", "Это действие нельзя отменить.", [
      { text: "Отмена", style: "cancel" },
      { text: "Удалить", style: "destructive", onPress: async () => {
        setBusy(true);
        try { await onDelete(post.id); } finally { setBusy(false); }
      }},
    ]);
  };

  const handlePublishNow = () => {
    Alert.alert("Опубликовать сейчас?", "Пост будет опубликован немедленно.", [
      { text: "Отмена", style: "cancel" },
      { text: "Опубликовать", onPress: async () => {
        setBusy(true);
        try { await onPublishNow(post.id); } finally { setBusy(false); }
      }},
    ]);
  };

  return (
    <View style={[st.card, { backgroundColor: c.SURFACE, borderColor: c.LINE }]}>
      {/* Scheduled time */}
      <View style={st.timeRow}>
        <Feather name="clock" size={13} color={c.ACCENT} />
        <Text style={[st.timeText, { color: c.ACCENT }]}>{fmtScheduled(post.scheduled_for)}</Text>
        {post.whisper ? (
          <View style={[st.badge, { backgroundColor: `${c.INK_SOFT}18` }]}>
            <Feather name="lock" size={10} color={c.INK_SOFT} />
            <Text style={[st.badgeText, { color: c.INK_SOFT }]}>Приватный</Text>
          </View>
        ) : null}
      </View>

      {/* Body preview */}
      {!!post.body && (
        <Text style={[st.body, { color: c.INK }]} numberOfLines={4}>
          {post.body}
        </Text>
      )}
      {!post.body && (
        <Text style={[st.bodyEmpty, { color: c.INK_SOFT }]}>— без текста —</Text>
      )}

      {/* Poll indicator */}
      {post.poll && (
        <View style={[st.pollPill, { backgroundColor: `${c.ACCENT}12` }]}>
          <Feather name="bar-chart-2" size={12} color={c.ACCENT} />
          <Text style={[st.pollText, { color: c.ACCENT }]}>Опрос: {post.poll?.question || "..."}</Text>
        </View>
      )}

      {/* Actions */}
      <View style={st.actions}>
        <TouchableOpacity
          style={[st.btn, st.btnPublish, { backgroundColor: c.ACCENT }]}
          onPress={handlePublishNow}
          disabled={busy}
          activeOpacity={0.8}
        >
          {busy
            ? <ActivityIndicator size="small" color="#fff" />
            : <>
                <Feather name="send" size={13} color="#fff" />
                <Text style={st.btnPublishText}>Опубликовать сейчас</Text>
              </>
          }
        </TouchableOpacity>
        <TouchableOpacity
          style={[st.btn, st.btnDelete, { backgroundColor: `#e05a5a18`, borderColor: `#e05a5a40` }]}
          onPress={handleDelete}
          disabled={busy}
          activeOpacity={0.8}
        >
          <Feather name="trash-2" size={13} color="#e05a5a" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function ScheduledPostsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const c = useTheme();

  const [posts, setPosts]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await api("/posts/scheduled");
      setPosts(Array.isArray(list) ? list : []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const onDelete = async (id) => {
    try {
      const updated = await api(`/posts/scheduled/${id}`, { method: "DELETE" });
      setPosts(Array.isArray(updated) ? updated : posts.filter(p => p.id !== id));
      haptic.success();
    } catch (e) {
      Alert.alert("Ошибка", e.message || "Не удалось удалить");
    }
  };

  const onPublishNow = async (id) => {
    try {
      await api(`/posts/scheduled/${id}/publish-now`, { method: "POST" });
      setPosts(prev => prev.filter(p => p.id !== id));
      haptic.success();
      Alert.alert("Готово", "Пост опубликован!");
    } catch (e) {
      Alert.alert("Ошибка", e.message || "Не удалось опубликовать");
    }
  };

  return (
    <View style={[st.root, { backgroundColor: c.BG }]}>
      {/* Header */}
      <View style={[st.header, { paddingTop: insets.top + 6, backgroundColor: c.SURFACE, borderBottomColor: c.LINE }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={c.ACCENT} />
        </TouchableOpacity>
        <Text style={[st.title, { color: c.INK }]}>Запланированные посты</Text>
        <View style={st.backBtn} />
      </View>

      {loading ? (
        <View style={st.center}><ActivityIndicator color={c.ACCENT} size="large" /></View>
      ) : (
        <ScrollView
          contentContainerStyle={[st.list, { paddingBottom: insets.bottom + 24 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={c.ACCENT} />}
        >
          {posts.length === 0 ? (
            <View style={st.empty}>
              <Feather name="clock" size={38} color={c.INK_SOFT} style={{ opacity: 0.4 }} />
              <Text style={[st.emptyText, { color: c.INK_SOFT }]}>Нет запланированных постов</Text>
              <Text style={[st.emptyHint, { color: c.INK_SOFT }]}>
                При создании поста выбери дату публикации — он появится здесь
              </Text>
            </View>
          ) : (
            posts.map(post => (
              <PostCard
                key={post.id}
                post={post}
                onDelete={onDelete}
                onPublishNow={onPublishNow}
              />
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root:          { flex: 1 },
  header:        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn:       { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title:         { fontSize: 17, fontWeight: "800" },
  center:        { flex: 1, alignItems: "center", justifyContent: "center" },
  list:          { padding: 16, gap: 12 },

  card:          { borderRadius: 18, padding: 16, borderWidth: StyleSheet.hairlineWidth, gap: 10 },
  timeRow:       { flexDirection: "row", alignItems: "center", gap: 6 },
  timeText:      { fontSize: 13, fontWeight: "700" },
  badge:         { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginLeft: "auto" },
  badgeText:     { fontSize: 11, fontWeight: "600" },

  body:          { fontSize: 14.5, lineHeight: 21 },
  bodyEmpty:     { fontSize: 14, fontStyle: "italic" },

  pollPill:      { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, alignSelf: "flex-start" },
  pollText:      { fontSize: 12.5, fontWeight: "600" },

  actions:       { flexDirection: "row", gap: 8, marginTop: 4 },
  btn:           { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12 },
  btnPublish:    { flex: 1, justifyContent: "center" },
  btnPublishText:{ color: "#fff", fontSize: 13.5, fontWeight: "700" },
  btnDelete:     { borderWidth: 1 },

  empty:         { alignItems: "center", paddingTop: 60, gap: 12, paddingHorizontal: 32 },
  emptyText:     { fontSize: 16, fontWeight: "700" },
  emptyHint:     { fontSize: 13.5, textAlign: "center", lineHeight: 20, opacity: 0.7 },
});
