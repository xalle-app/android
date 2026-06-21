import { useState, useRef, useCallback } from "react";
import {
  View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, Image,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import Avatar from "../components/Avatar.jsx";
import Post from "../components/Post.jsx";
import UserName from "../components/UserName.jsx";
import { api, assetUrl } from "../lib/api.js";
import { haptic } from "../lib/haptics.js";
import { timeAgo } from "../lib/format.js";
import { useAuthStore } from "../store/auth.js";
import { useTheme } from "../store/theme.js";

const TABS = [
  { key: "posts", label: "Посты" },
  { key: "users", label: "Люди" },
];

function UserRow({ u, onPress }) {
  const c = useTheme();
  return (
    <TouchableOpacity style={[su.row, { backgroundColor: c.SURFACE, borderBottomColor: c.LINE }]} onPress={onPress} activeOpacity={0.8}>
      <Avatar url={u.avatar_url} name={u.name} size={44} />
      <View style={su.info}>
        <UserName name={u.name} verified={u.verified} role={u.role} nameColor={u.name_color} nameGradient={u.name_gradient} subTier={u.subscription_tier} style={su.name} />
        <Text style={[su.handle, { color: c.INK_SOFT }]}>@{u.handle}</Text>
        {!!u.bio && <Text style={[su.bio, { color: c.INK_SOFT }]} numberOfLines={1}>{u.bio}</Text>}
      </View>
    </TouchableOpacity>
  );
}

export default function SearchScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const me = useAuthStore(s => s.user);
  const inputRef = useRef(null);

  const [tab,     setTab]     = useState("posts");
  const [query,   setQuery]   = useState("");
  const [posts,   setPosts]   = useState([]);
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(false);
  const searchTimer = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (!q.trim()) { setPosts([]); setUsers([]); return; }
    setLoading(true);
    try {
      const [postRes, userRes] = await Promise.all([
        api(`/posts?q=${encodeURIComponent(q)}`),
        api(`/users/search?q=${encodeURIComponent(q)}`),
      ]);
      setPosts(Array.isArray(postRes) ? postRes : []);
      setUsers(Array.isArray(userRes) ? userRes : []);
    } catch {}
    setLoading(false);
  }, []);

  const handleChange = (v) => {
    setQuery(v);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => doSearch(v), 400);
  };

  const handleReact = async (postId, emoji) => {
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const counts = { ...(p.reactions?.counts || {}) };
      const prevReaction = p.reactions?.userReaction ?? p.my_reaction ?? null;
      if (prevReaction) counts[prevReaction] = Math.max(0, (counts[prevReaction] || 1) - 1);
      const isToggle = prevReaction === emoji;
      if (!isToggle) counts[emoji] = (counts[emoji] || 0) + 1;
      return { ...p, reactions: { ...p.reactions, counts, userReaction: isToggle ? null : emoji } };
    }));
    try {
      const updated = await api(`/posts/${postId}/react`, { method: "POST", body: { emoji } });
      if (updated?.reactions) setPosts(prev => prev.map(p => p.id === postId ? { ...p, reactions: updated.reactions } : p));
    } catch {}
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: c.BG }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: c.SURFACE, borderBottomColor: c.LINE }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={c.ACCENT} />
        </TouchableOpacity>
        <View style={[styles.searchWrap, { backgroundColor: c.WARM }]}>
          <Feather name="search" size={15} color={c.INK_SOFT} />
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: c.INK }]}
            placeholder="Поиск постов, людей..."
            placeholderTextColor={c.INK_SOFT}
            value={query}
            onChangeText={handleChange}
            autoFocus
            returnKeyType="search"
            onSubmitEditing={() => doSearch(query)}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => { setQuery(""); setPosts([]); setUsers([]); }}>
              <Feather name="x" size={15} color={c.INK_SOFT} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Tabs */}
      <View style={[styles.tabs, { backgroundColor: c.SURFACE, borderBottomColor: c.LINE }]}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.key}
            style={styles.tabBtn}
            onPress={() => { setTab(t.key); haptic.select(); }}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, { color: tab === t.key ? c.ACCENT : c.INK_SOFT }]}>{t.label}</Text>
            {tab === t.key && (
              <View style={[styles.tabIndicator, { backgroundColor: c.ACCENT }]} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Results */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={c.ACCENT} size="large" /></View>
      ) : tab === "posts" ? (
        <FlatList
          data={posts}
          keyExtractor={p => String(p.id)}
          renderItem={({ item }) => (
            <Post
              post={item}
              me={me}
              onPress={() => navigation.navigate("PostDetail", { post: item })}
              onReact={emoji => handleReact(item.id, emoji)}
              onAvatarPress={() => navigation.navigate("UserProfile", { handle: item.handle })}
              onMentionPress={handle => navigation.navigate("UserProfile", { handle })}
              onDelete={id => setPosts(prev => prev.filter(p => p.id !== id))}
            />
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={
            query.trim()
              ? <View style={styles.empty}><Text style={[styles.emptyText, { color: c.INK_SOFT }]}>Ничего не найдено</Text></View>
              : <View style={styles.emptyHint}><Feather name="search" size={40} color={c.LINE} /><Text style={[styles.emptyHintText, { color: c.INK_SOFT }]}>Введи запрос для поиска</Text></View>
          }
        />
      ) : (
        <FlatList
          data={users}
          keyExtractor={u => String(u.id)}
          renderItem={({ item }) => (
            <UserRow u={item} onPress={() => navigation.navigate("UserProfile", { handle: item.handle })} />
          )}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={
            query.trim()
              ? <View style={styles.empty}><Text style={[styles.emptyText, { color: c.INK_SOFT }]}>Никого не найдено</Text></View>
              : <View style={styles.emptyHint}><Feather name="users" size={40} color={c.LINE} /><Text style={[styles.emptyHintText, { color: c.INK_SOFT }]}>Введи имя или @handle</Text></View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1 },
  header:       { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 1 },
  backBtn:      { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  searchWrap:   { flex: 1, flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, paddingHorizontal: 12, height: 40 },
  input:        { flex: 1, fontSize: 15 },

  tabs:         { flexDirection: "row", borderBottomWidth: 1 },
  tabBtn:       { flex: 1, alignItems: "center", paddingVertical: 12, position: "relative" },
  tabText:      { fontSize: 14, fontWeight: "600" },
  tabIndicator: { position: "absolute", bottom: 0, left: "20%", right: "20%", height: 2, borderRadius: 1 },

  center:       { flex: 1, alignItems: "center", justifyContent: "center" },
  empty:        { alignItems: "center", paddingTop: 60 },
  emptyText:    { fontSize: 15 },
  emptyHint:    { alignItems: "center", paddingTop: 80, gap: 14 },
  emptyHintText:{ fontSize: 15 },
});

const su = StyleSheet.create({
  row:   { flexDirection: "row", gap: 12, padding: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  info:  { flex: 1, justifyContent: "center" },
  name:  { fontSize: 14.5, fontWeight: "700" },
  handle:{ fontSize: 12.5, marginTop: 1 },
  bio:   { fontSize: 12.5, marginTop: 3 },
});
