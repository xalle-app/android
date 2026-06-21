import { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import Post from "../components/Post.jsx";
import { api } from "../lib/api.js";
import { useAuthStore } from "../store/auth.js";
import { useTheme } from "../store/theme.js";

export default function OpenCollabsScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const user = useAuthStore(s => s.user);

  const [posts, setPosts]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const data = await api("/collabs");
      setPosts(Array.isArray(data) ? data : []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  return (
    <View style={[st.root, { backgroundColor: c.BG }]}>
      <View style={[st.header, { paddingTop: insets.top + 6, backgroundColor: c.SURFACE, borderBottomColor: c.LINE }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={c.ACCENT} />
        </TouchableOpacity>
        <Text style={[st.title, { color: c.INK }]}>Сборные посты</Text>
        <View style={st.backBtn} />
      </View>

      {loading ? (
        <View style={st.center}><ActivityIndicator color={c.ACCENT} size="large" /></View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <Post
              post={item}
              me={user}
              onAvatarPress={() => navigation.navigate("UserProfile", { handle: item.handle })}
              onPress={() => navigation.navigate("PostDetail", { post: item })}
              onMentionPress={handle => navigation.navigate("UserProfile", { handle })}
            />
          )}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={c.ACCENT} />
          }
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          ListHeaderComponent={
            <View style={[st.desc, { backgroundColor: c.WARM, borderColor: c.LINE }]}>
              <Feather name="users" size={15} color={c.ACCENT} />
              <Text style={[st.descText, { color: c.INK_SOFT }]}>
                Открытые коллаборативные посты — добавь свой блок к чужому посту
              </Text>
            </View>
          }
          ListEmptyComponent={
            <View style={st.empty}>
              <Feather name="users" size={38} color={c.INK_SOFT} style={{ opacity: 0.4 }} />
              <Text style={[st.emptyText, { color: c.INK_SOFT }]}>Нет открытых сборных постов</Text>
              <Text style={[st.emptyHint, { color: c.INK_SOFT }]}>
                Создай пост с пометкой «Сборный» — другие смогут добавить свои блоки
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root:      { flex: 1 },
  header:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn:   { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title:     { fontSize: 17, fontWeight: "800" },
  center:    { flex: 1, alignItems: "center", justifyContent: "center" },
  desc:      { flexDirection: "row", alignItems: "flex-start", gap: 8, margin: 12, padding: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  descText:  { flex: 1, fontSize: 13, lineHeight: 18 },
  empty:     { alignItems: "center", paddingTop: 60, gap: 12, paddingHorizontal: 32 },
  emptyText: { fontSize: 16, fontWeight: "700" },
  emptyHint: { fontSize: 13.5, textAlign: "center", lineHeight: 20, opacity: 0.7 },
});
