import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, RefreshControl, StyleSheet,
  TouchableOpacity, Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Feather from "@expo/vector-icons/Feather";
import Avatar from "../components/Avatar.jsx";
import UserName from "../components/UserName.jsx";
import Post from "../components/Post.jsx";
import Achievements from "../components/Achievements.jsx";
import { api } from "../lib/api.js";
import { useAuthStore } from "../store/auth.js";
import { useTheme } from "../store/theme.js";

const W = Dimensions.get("window").width;
const COVER_H = 130;

const QUICK = [
  { icon: "calendar",    emoji: "🗓️",  label: "Даты",     screen: "MemorableDates" },
  { icon: "check-square", emoji: "✅", label: "Планер",   screen: "Planner" },
  { icon: "bookmark",    emoji: "🔖",  label: "Закладки", screen: "Bookmarks" },
  { icon: "clock",       emoji: "📅",  label: "Отложено", screen: "ScheduledPosts" },
  { icon: "music",       emoji: "🎵",  label: "Музыка",   screen: "Music" },
];

export default function ProfileScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const user   = useAuthStore(s => s.user);
  const c = useTheme();

  const [profile, setProfile]       = useState(null);
  const [posts, setPosts]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [prof, myPosts] = await Promise.all([
        api("/me"),
        api(`/posts?handle=${user?.handle}`),
      ]);
      setProfile(prof);
      setPosts(Array.isArray(myPosts) ? myPosts : []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [user?.handle]);

  useEffect(() => { load(); }, []);

  const p = profile || user;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.BG }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={c.ACCENT} />}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Cover banner ──────────────────────────────────────── */}
      <View style={[st.coverWrap, { paddingTop: insets.top }]}>
        <LinearGradient
          colors={[`${c.ACCENT}cc`, `${c.ACCENT}44`, "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        {/* Settings button */}
        <TouchableOpacity
          onPress={() => navigation.navigate("Settings")}
          style={[st.settingsBtn, { top: insets.top + 10, backgroundColor: `${c.SURFACE}bb` }]}
          activeOpacity={0.8}
        >
          <Feather name="settings" size={18} color={c.INK} />
        </TouchableOpacity>
      </View>

      {/* ── Avatar (overlapping cover) ─────────────────────── */}
      <View style={[st.avatarRow, { backgroundColor: c.BG }]}>
        <View style={[st.avatarBorder, { borderColor: c.BG }]}>
          <Avatar url={p?.avatar_url} name={p?.name} size={80} />
        </View>
        <View style={st.followBtnWrap}>
          <TouchableOpacity
            onPress={() => navigation.navigate("Settings")}
            style={[st.editBtn, { borderColor: c.ACCENT }]}
            activeOpacity={0.8}
          >
            <Text style={[st.editBtnText, { color: c.ACCENT }]}>Редактировать</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Name + handle + bio ───────────────────────────────── */}
      <View style={st.nameBlock}>
        <UserName
          name={p?.name || "—"}
          verified={p?.verified}
          role={p?.role}
          nameColor={p?.name_color}
          nameGradient={p?.name_gradient}
          subTier={p?.sub_tier ?? p?.subscription_tier ?? 0}
          style={st.nameText}
          numberOfLines={1}
        />
        <Text style={[st.handle, { color: c.INK_SOFT }]}>@{p?.handle}</Text>
        {!!p?.bio && (
          <Text style={[st.bio, { color: c.INK }]} numberOfLines={4}>{p.bio}</Text>
        )}
      </View>

      {/* ── Stats row ─────────────────────────────────────────── */}
      <View style={[st.statsRow, { backgroundColor: c.SURFACE }]}>
        <TouchableOpacity style={st.statItem} activeOpacity={0.7}>
          <Text style={[st.statNum, { color: c.INK }]}>{posts.length}</Text>
          <Text style={[st.statLabel, { color: c.INK_SOFT }]}>постов</Text>
        </TouchableOpacity>
        <View style={[st.statDiv, { backgroundColor: c.LINE }]} />
        <TouchableOpacity
          style={st.statItem}
          onPress={() => navigation.navigate("FollowList", { handle: user?.handle, kind: "followers" })}
          activeOpacity={0.7}
        >
          <Text style={[st.statNum, { color: c.INK }]}>{p?.followers_count ?? 0}</Text>
          <Text style={[st.statLabel, { color: c.INK_SOFT }]}>подписчиков</Text>
        </TouchableOpacity>
        <View style={[st.statDiv, { backgroundColor: c.LINE }]} />
        <TouchableOpacity
          style={st.statItem}
          onPress={() => navigation.navigate("FollowList", { handle: user?.handle, kind: "following" })}
          activeOpacity={0.7}
        >
          <Text style={[st.statNum, { color: c.INK }]}>{p?.following_count ?? 0}</Text>
          <Text style={[st.statLabel, { color: c.INK_SOFT }]}>подписок</Text>
        </TouchableOpacity>
      </View>

      {/* ── Quick links ───────────────────────────────────────── */}
      <View style={st.quickRow}>
        {QUICK.map(q => (
          <TouchableOpacity
            key={q.screen}
            style={[st.quickCard, { backgroundColor: c.SURFACE }]}
            onPress={() => navigation.navigate(q.screen)}
            activeOpacity={0.75}
          >
            <Text style={st.quickEmoji}>{q.emoji}</Text>
            <Text style={[st.quickLabel, { color: c.INK_SOFT }]}>{q.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── Achievements ──────────────────────────────────────── */}
      <Achievements handle={p?.handle} />

      {/* ── Posts ─────────────────────────────────────────────── */}
      <View style={[st.sectionHead, { borderBottomColor: c.LINE }]}>
        <Text style={[st.sectionTitle, { color: c.INK }]}>Мои посты</Text>
        <View style={[st.sectionBadge, { backgroundColor: `${c.ACCENT}20` }]}>
          <Text style={[st.sectionBadgeText, { color: c.ACCENT }]}>{posts.length}</Text>
        </View>
      </View>

      {loading ? (
        <Text style={[st.emptyText, { color: c.INK_SOFT }]}>Загрузка...</Text>
      ) : posts.length === 0 ? (
        <View style={st.emptyBox}>
          <Feather name="edit-2" size={32} color={c.INK_SOFT} style={{ opacity: 0.4 }} />
          <Text style={[st.emptyText, { color: c.INK_SOFT }]}>Нет постов</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate("Compose")}
            style={[st.composeBtn, { backgroundColor: c.ACCENT }]}
            activeOpacity={0.85}
          >
            <Feather name="edit-3" size={15} color="#fff" />
            <Text style={st.composeBtnText}>Написать первый пост</Text>
          </TouchableOpacity>
        </View>
      ) : (
        posts.map(post => (
          <Post
            key={post.id}
            post={post}
            me={user}
            onPress={() => navigation.navigate("PostDetail", { post })}
          />
        ))
      )}
    </ScrollView>
  );
}

const st = StyleSheet.create({
  coverWrap:     { height: COVER_H + 60, overflow: "hidden", backgroundColor: "#1a1a2e" },
  settingsBtn:   { position: "absolute", right: 16, width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },

  avatarRow:     { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 16, marginTop: -40, paddingBottom: 12 },
  avatarBorder:  { borderWidth: 4, borderRadius: 46, overflow: "hidden" },
  followBtnWrap: { paddingBottom: 4 },
  editBtn:       { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 8 },
  editBtnText:   { fontSize: 13.5, fontWeight: "700" },

  nameBlock:     { paddingHorizontal: 16, paddingBottom: 14, gap: 3 },
  nameText:      { fontSize: 22, fontWeight: "900" },
  handle:        { fontSize: 14 },
  bio:           { fontSize: 14.5, lineHeight: 22, marginTop: 6 },

  statsRow:      { flexDirection: "row", marginHorizontal: 16, borderRadius: 16, overflow: "hidden", marginBottom: 16 },
  statItem:      { flex: 1, alignItems: "center", paddingVertical: 14 },
  statNum:       { fontSize: 20, fontWeight: "800" },
  statLabel:     { fontSize: 12, marginTop: 2 },
  statDiv:       { width: StyleSheet.hairlineWidth, marginVertical: 12 },

  quickRow:      { flexDirection: "row", paddingHorizontal: 16, gap: 8, marginBottom: 16 },
  quickCard:     { flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 14, gap: 4 },
  quickEmoji:    { fontSize: 22 },
  quickLabel:    { fontSize: 11, fontWeight: "600" },

  sectionHead:   { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  sectionTitle:  { fontSize: 16, fontWeight: "700" },
  sectionBadge:  { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  sectionBadgeText: { fontSize: 12, fontWeight: "700" },

  emptyBox:      { alignItems: "center", paddingTop: 40, gap: 14 },
  emptyText:     { textAlign: "center", fontSize: 14 },
  composeBtn:    { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14, marginTop: 4 },
  composeBtnText:{ color: "#fff", fontSize: 14, fontWeight: "700" },
});
