import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
  FlatList, View, Text, RefreshControl,
  StyleSheet, TextInput, TouchableOpacity, Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import Feather from "@expo/vector-icons/Feather";
import Post from "../components/Post.jsx";
import { api } from "../lib/api.js";
import { wsOn } from "../lib/ws.js";
import { useAuthStore } from "../store/auth.js";
import { useTheme } from "../store/theme.js";

function SkeletonPost() {
  const c = useTheme();
  return (
    <View style={[sk.card, { backgroundColor: c.SURFACE }]}>
      <View style={sk.row}>
        <View style={[sk.avatar, { backgroundColor: c.WARM }]} />
        <View style={{ flex: 1, gap: 7 }}>
          <View style={[sk.line, { width: "48%", backgroundColor: c.WARM }]} />
          <View style={[sk.line, { width: "28%", backgroundColor: c.WARM }]} />
        </View>
      </View>
      <View style={[sk.line, { width: "100%", height: 13, marginTop: 10, backgroundColor: c.WARM }]} />
      <View style={[sk.line, { width: "75%", height: 13, marginTop: 6, backgroundColor: c.WARM }]} />
      <View style={[sk.line, { width: "55%", height: 13, marginTop: 6, backgroundColor: c.WARM }]} />
    </View>
  );
}

const SCOPES = [
  { key: "world",           label: "Все" },
  { key: "following",       label: "Подписки" },
  { key: "recommendations", label: "Для тебя" },
];

const SORT_OPTIONS = [
  { key: "newest",  label: "Новые" },
  { key: "popular", label: "Популярные" },
  { key: "oldest",  label: "Старые" },
];

export default function FeedScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const user = useAuthStore(s => s.user);
  const c = useTheme();
  const [posts, setPosts]       = useState([]);
  const [scope, setScope]       = useState("world");
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery]       = useState("");
  const [newPosts, setNewPosts] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort]         = useState("newest");
  const [onlyMedia, setOnlyMedia] = useState(false);
  const filterAnim = useRef(new Animated.Value(0)).current;

  const listRef    = useRef(null);
  const bannerAnim = useRef(new Animated.Value(-56)).current;

  const showBanner = useCallback(() => {
    setNewPosts(true);
    Animated.spring(bannerAnim, {
      toValue: 0, useNativeDriver: true, tension: 80, friction: 11,
    }).start();
  }, [bannerAnim]);

  const hideBanner = useCallback(() => {
    Animated.timing(bannerAnim, {
      toValue: -56, duration: 220, useNativeDriver: true,
    }).start(() => setNewPosts(false));
  }, [bannerAnim]);

  const load = useCallback(async () => {
    try {
      const data = await api(`/posts?scope=${scope}`);
      setPosts(Array.isArray(data) ? data : []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [scope]);

  useEffect(() => {
    setLoading(true);
    setPosts([]);
    load();
  }, [scope]);

  const isFirstFocus = useRef(true);
  useFocusEffect(useCallback(() => {
    if (isFirstFocus.current) { isFirstFocus.current = false; return; }
    load();
  }, [load]));

  useEffect(() => {
    const offs = [
      wsOn("posts", () => { if (!query) showBanner(); }),
      wsOn("reaction:update", (m) => {
        if (!m.postId) return;
        setPosts(prev => prev.map(p =>
          p.id === m.postId
            ? { ...p, reactions: { ...p.reactions, counts: m.counts } }
            : p
        ));
      }),
      wsOn("view:update", (m) => {
        if (!m.postId) return;
        setPosts(prev => prev.map(p =>
          p.id === m.postId ? { ...p, views: m.views } : p
        ));
      }),
      wsOn("user:update", (m) => {
        if (!m.handle && !m.id) return;
        setPosts(prev => prev.map(p => {
          if (p.handle !== m.handle && p.user_id !== m.id) return p;
          return {
            ...p,
            name:          m.name          ?? p.name,
            avatar_url:    m.avatar_url    ?? p.avatar_url,
            name_color:    m.name_color    !== undefined ? m.name_color    : p.name_color,
            name_gradient: m.name_gradient !== undefined ? m.name_gradient : p.name_gradient,
          };
        }));
      }),
    ];
    return () => offs.forEach(off => off());
  }, [query, showBanner]);

  const onRefresh = () => {
    setRefreshing(true);
    hideBanner();
    load();
  };

  const handleBannerPress = () => {
    hideBanner();
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    load();
  };

  const handleReact = async (postId, emoji) => {
    setPosts(prev => prev.map(p => {
      if (p.id !== postId) return p;
      const counts = { ...(p.reactions?.counts || {}) };
      const prev_reaction = p.reactions?.userReaction ?? p.my_reaction ?? null;
      if (prev_reaction) counts[prev_reaction] = Math.max(0, (counts[prev_reaction] || 1) - 1);
      const isToggle = prev_reaction === emoji;
      if (!isToggle) counts[emoji] = (counts[emoji] || 0) + 1;
      return { ...p, reactions: { ...p.reactions, counts, userReaction: isToggle ? null : emoji } };
    }));
    try {
      const updated = await api(`/posts/${postId}/react`, { method: "POST", body: { emoji } });
      if (updated?.reactions) {
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, reactions: updated.reactions } : p));
      }
    } catch {}
  };

  useEffect(() => {
    Animated.spring(filterAnim, { toValue: filterOpen ? 1 : 0, useNativeDriver: true, tension: 65, friction: 11 }).start();
  }, [filterOpen]);

  const filtered = useMemo(() => {
    let result = [...posts];
    const q = query.trim().toLowerCase();
    if (q) result = result.filter(p =>
      p.body?.toLowerCase().includes(q) ||
      p.handle?.toLowerCase().includes(q) ||
      p.name?.toLowerCase().includes(q)
    );
    if (onlyMedia) result = result.filter(p => {
      try { const imgs = typeof p.images === "string" ? JSON.parse(p.images) : p.images; return Array.isArray(imgs) && imgs.length > 0; } catch { return false; }
    });
    if (sort === "popular") result.sort((a, b) => ((b.reactions?.total ?? 0) + (b.reposts ?? 0)) - ((a.reactions?.total ?? 0) + (a.reposts ?? 0)));
    if (sort === "oldest")  result.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    return result;
  }, [posts, query, sort, onlyMedia]);

  const hasFilters = sort !== "newest" || onlyMedia;

  return (
    <View style={[styles.root, { backgroundColor: c.BG }]}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10, backgroundColor: c.SURFACE, borderBottomColor: c.LINE }]}>
        <Text style={[styles.logo, { color: c.ACCENT }]}>xalle</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: c.WARM }, hasFilters && { backgroundColor: `${c.ACCENT}15`, borderColor: c.ACCENT, borderWidth: 1 }]}
            onPress={() => setFilterOpen(v => !v)}
            activeOpacity={0.7}
          >
            <Feather name="sliders" size={17} color={hasFilters ? c.ACCENT : c.INK_SOFT} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: c.WARM }]}
            onPress={() => navigation.navigate("OpenCollabs")}
            activeOpacity={0.7}
          >
            <Feather name="users" size={18} color={c.INK_SOFT} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.iconBtn, { backgroundColor: c.WARM }]}
            onPress={() => navigation.navigate("Search")}
            activeOpacity={0.7}
          >
            <Feather name="search" size={18} color={c.INK_SOFT} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter panel */}
      {filterOpen && (
        <View style={[styles.filterPanel, { backgroundColor: c.SURFACE, borderBottomColor: c.LINE }]}>
          <Text style={[styles.filterLabel, { color: c.INK_SOFT }]}>Сортировка</Text>
          <View style={styles.filterRow}>
            {SORT_OPTIONS.map(o => (
              <TouchableOpacity
                key={o.key}
                style={[styles.filterChip, { borderColor: c.LINE, backgroundColor: c.WARM }, sort === o.key && { backgroundColor: `${c.ACCENT}15`, borderColor: c.ACCENT }]}
                onPress={() => setSort(o.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, { color: sort === o.key ? c.ACCENT : c.INK_SOFT }, sort === o.key && { fontWeight: "700" }]}>{o.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.filterRow}>
            <TouchableOpacity
              style={[styles.filterChip, { borderColor: c.LINE, backgroundColor: c.WARM }, onlyMedia && { backgroundColor: `${c.ACCENT}15`, borderColor: c.ACCENT }]}
              onPress={() => setOnlyMedia(v => !v)}
              activeOpacity={0.7}
            >
              <Feather name="image" size={13} color={onlyMedia ? c.ACCENT : c.INK_SOFT} style={{ marginRight: 4 }} />
              <Text style={[styles.filterChipText, { color: onlyMedia ? c.ACCENT : c.INK_SOFT }, onlyMedia && { fontWeight: "700" }]}>Только с медиа</Text>
            </TouchableOpacity>
            {hasFilters && (
              <TouchableOpacity onPress={() => { setSort("newest"); setOnlyMedia(false); }} style={styles.filterReset} activeOpacity={0.7}>
                <Feather name="x" size={13} color={c.ACCENT} />
                <Text style={[styles.filterResetText, { color: c.ACCENT }]}>Сбросить</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* Scope tabs */}
      <View style={[styles.tabs, { backgroundColor: c.SURFACE, borderBottomColor: c.LINE }]}>
        {SCOPES.map(s => (
          <TouchableOpacity
            key={s.key}
            style={[styles.tab, scope === s.key && { borderBottomColor: c.ACCENT }]}
            onPress={() => setScope(s.key)} activeOpacity={0.7}
          >
            <Text style={[styles.tabText, { color: scope === s.key ? c.ACCENT : c.INK_SOFT }, scope === s.key && { fontWeight: "700" }]}>{s.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: c.SURFACE }]}>
        <View style={[styles.searchInner, { backgroundColor: c.WARM, borderColor: c.LINE }]}>
          <Feather name="search" size={14} color={c.INK_SOFT} style={{ marginRight: 6 }} />
          <TextInput
            style={[styles.search, { color: c.INK }]} placeholder="Поиск в ленте..." placeholderTextColor={c.INK_SOFT}
            value={query} onChangeText={setQuery} returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")} style={styles.searchClear}>
              <Feather name="x" size={14} color={c.INK_SOFT} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* List */}
      {loading ? (
        <FlatList
          data={[1,2,3,4]}
          keyExtractor={i => String(i)}
          renderItem={() => <SkeletonPost />}
          contentContainerStyle={{ paddingTop: 4 }}
        />
      ) : (
        <FlatList
          ref={listRef}
          data={filtered}
          keyExtractor={p => String(p.id)}
          renderItem={({ item }) => (
            <Post
              post={item}
              me={user}
              onPress={() => navigation.navigate("PostDetail", { post: item })}
              onReact={(emoji) => handleReact(item.id, emoji)}
              onAvatarPress={() => navigation.navigate("UserProfile", { handle: item.handle })}
              onMentionPress={handle => navigation.navigate("UserProfile", { handle })}
              onDelete={id => setPosts(prev => prev.filter(p => p.id !== id))}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.ACCENT} />}
          contentContainerStyle={{ paddingTop: 4, paddingBottom: insets.bottom + 90 }}
          removeClippedSubviews
          maxToRenderPerBatch={8}
          windowSize={5}
          initialNumToRender={8}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Feather name="wind" size={36} color={c.INK_SOFT} style={{ opacity: 0.4, marginBottom: 12 }} />
              <Text style={[styles.emptyText, { color: c.INK_SOFT }]}>{query ? "Ничего не найдено" : "Пока нет постов"}</Text>
            </View>
          }
        />
      )}

      {/* New posts banner */}
      {newPosts && (
        <Animated.View
          style={[styles.newBannerWrap, { transform: [{ translateY: bannerAnim }] }]}
          pointerEvents="box-none"
        >
          <TouchableOpacity style={[styles.newBannerBtn, { backgroundColor: c.ACCENT, shadowColor: c.ACCENT }]} onPress={handleBannerPress} activeOpacity={0.85}>
            <Feather name="arrow-up" size={14} color="#fff" />
            <Text style={styles.newBannerText}>Новые посты</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, { bottom: insets.bottom + 22, backgroundColor: c.ACCENT, shadowColor: c.ACCENT }]}
        onPress={() => navigation.navigate("Compose")}
        activeOpacity={0.85}
      >
        <Feather name="edit-2" size={20} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root:          { flex: 1 },

  header:        { paddingHorizontal: 16, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: StyleSheet.hairlineWidth },
  logo:          { fontSize: 26, fontWeight: "900", letterSpacing: -1, fontStyle: "italic" },
  headerRight:   { flexDirection: "row", gap: 8 },
  iconBtn:       { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },

  tabs:          { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  tab:           { flex: 1, paddingVertical: 11, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText:       { fontSize: 14, fontWeight: "600" },

  searchWrap:    { paddingHorizontal: 14, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  searchInner:   { flexDirection: "row", alignItems: "center", borderRadius: 12, paddingHorizontal: 12, borderWidth: 1, height: 38 },
  search:        { flex: 1, fontSize: 14 },
  searchClear:   { padding: 4 },

  empty:         { alignItems: "center", paddingTop: 80 },
  emptyText:     { fontSize: 15, marginTop: 0 },

  newBannerWrap: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center", zIndex: 20, pointerEvents: "box-none" },
  newBannerBtn:  { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, shadowOpacity: 0.4, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 8 },
  newBannerText: { color: "#fff", fontSize: 13.5, fontWeight: "700" },

  fab: { position: "absolute", right: 18, width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", shadowOpacity: 0.45, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 8 },

  filterPanel:    { paddingHorizontal: 14, paddingVertical: 10, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  filterLabel:    { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginBottom: 2 },
  filterRow:      { flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" },
  filterChip:     { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  filterChipText: { fontSize: 13 },
  filterReset:    { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6 },
  filterResetText:{ fontSize: 13, fontWeight: "600" },
});

const sk = StyleSheet.create({
  card:   { marginHorizontal: 14, marginVertical: 6, borderRadius: 16, padding: 16 },
  row:    { flexDirection: "row", gap: 10, marginBottom: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  line:   { height: 12, borderRadius: 6 },
});
