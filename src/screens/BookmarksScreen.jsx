import { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import Post from "../components/Post.jsx";
import { api } from "../lib/api.js";
import { useAuthStore } from "../store/auth.js";
import { useTheme } from "../store/theme.js";

export default function BookmarksScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const me = useAuthStore(s => s.user);
  const c = useTheme();

  const [posts, setPosts]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api("/v2/bookmarks");
      setPosts(Array.isArray(data) ? data : []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, []);

  const onRefresh = () => { setRefreshing(true); load(); };

  return (
    <View style={[st.root, { paddingTop: insets.top, backgroundColor: c.BG }]}>
      <View style={[st.header, { backgroundColor: c.SURFACE, borderBottomColor: c.LINE }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={c.ACCENT} />
        </TouchableOpacity>
        <Text style={[st.title, { color: c.INK }]}>Закладки</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={st.center}>
          <ActivityIndicator color={c.ACCENT} size="large" />
        </View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={p => String(p.id)}
          renderItem={({ item }) => (
            <Post
              post={item}
              me={me}
              onPress={() => navigation.navigate("PostDetail", { post: item })}
              onAvatarPress={() => navigation.navigate("UserProfile", { handle: item.handle })}
              onMentionPress={h => navigation.navigate("UserProfile", { handle: h })}
              onDelete={id => setPosts(prev => prev.filter(p => p.id !== id))}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.ACCENT} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={
            <View style={st.empty}>
              <Feather name="bookmark" size={40} color={c.INK_SOFT} style={{ opacity: 0.35, marginBottom: 12 }} />
              <Text style={[st.emptyText, { color: c.INK_SOFT }]}>Нет сохранённых постов</Text>
              <Text style={[st.emptyHint, { color: c.INK_SOFT }]}>Долгое нажатие на пост → «Сохранить»</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root:      { flex: 1 },
  header:    { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  backBtn:   { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title:     { flex: 1, fontSize: 17, fontWeight: "700", textAlign: "center" },
  center:    { flex: 1, alignItems: "center", justifyContent: "center" },
  empty:     { alignItems: "center", paddingTop: 80 },
  emptyText: { fontSize: 16, fontWeight: "600" },
  emptyHint: { fontSize: 13, marginTop: 6, opacity: 0.7 },
});
