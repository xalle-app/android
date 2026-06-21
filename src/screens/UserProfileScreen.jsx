import { useState, useEffect, useCallback, useMemo } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Image, Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import Avatar from "../components/Avatar.jsx";
import UserName from "../components/UserName.jsx";
import Post from "../components/Post.jsx";
import Achievements from "../components/Achievements.jsx";
import { api, assetUrl } from "../lib/api.js";
import { useAuthStore } from "../store/auth.js";
import { useTheme } from "../store/theme.js";

const SCREEN_W = Dimensions.get("window").width;
const MEDIA_COL = 3;
const MEDIA_SIZE = Math.floor(SCREEN_W / MEDIA_COL);

function StatBox({ value, label, onPress }) {
  const c = useTheme();
  const Wrap = onPress ? TouchableOpacity : View;
  return (
    <Wrap style={styles.statBox} onPress={onPress} activeOpacity={0.7}>
      <Text style={[styles.statNum, { color: c.INK }]}>{value ?? 0}</Text>
      <Text style={[styles.statLabel, { color: c.INK_SOFT }]}>{label}</Text>
    </Wrap>
  );
}

function extractMedia(posts) {
  const imgs = [];
  for (const p of posts) {
    let arr = [];
    if (p.images) {
      try { arr = typeof p.images === "string" ? JSON.parse(p.images) : p.images; } catch {}
    }
    for (const img of (Array.isArray(arr) ? arr : [])) {
      const url = typeof img === "string" ? img : img?.url;
      if (url) imgs.push({ url, postId: p.id, post: p });
    }
  }
  return imgs;
}

export default function UserProfileScreen({ route, navigation }) {
  const { handle } = route.params;
  const insets = useSafeAreaInsets();
  const me = useAuthStore(s => s.user);
  const c = useTheme();

  const [profile,    setProfile]    = useState(null);
  const [posts,      setPosts]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const [dmBusy,     setDmBusy]     = useState(false);
  const [tab,        setTab]        = useState("posts");

  const load = useCallback(async () => {
    try {
      const [prof, userPosts] = await Promise.all([
        api(`/profile/${handle}`),
        api(`/posts?handle=${handle}`),
      ]);
      setProfile(prof);
      setPosts(Array.isArray(userPosts) ? userPosts : []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [handle]);

  useEffect(() => { load(); }, []);

  const toggleFollow = async () => {
    if (!profile || followBusy) return;
    setFollowBusy(true);
    try {
      const method = profile.isFollowing ? "DELETE" : "POST";
      const updated = await api(`/follow/${handle}`, { method });
      if (updated?.handle) {
        setProfile(updated);
      } else {
        setProfile(p => ({ ...p, isFollowing: !p.isFollowing, followers: p.followers + (p.isFollowing ? -1 : 1) }));
      }
    } catch {} finally { setFollowBusy(false); }
  };

  const onRefresh = () => { setRefreshing(true); load(); };

  const isSelf = me?.handle === handle;

  const openDm = async () => {
    if (dmBusy) return;
    setDmBusy(true);
    try {
      const res = await api(`/messages/open/${handle}`, { method: "POST" });
      const convId = res?.convId ?? res?.id ?? res?.conv_id;
      if (!convId) return;
      navigation.navigate("ChatDetail", {
        conv: { id: convId, other_handle: handle, other_name: profile?.name, other_avatar: profile?.avatar_url },
      });
    } catch {} finally { setDmBusy(false); }
  };

  const media = useMemo(() => extractMedia(posts), [posts]);

  const Header = () => {
    if (loading) {
      return (
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={c.ACCENT} size="large" />
        </View>
      );
    }
    if (!profile) {
      return <View style={styles.loadingWrap}><Text style={[styles.emptyText, { color: c.INK_SOFT }]}>Пользователь не найден</Text></View>;
    }
    return (
      <View style={[styles.profileCard, { backgroundColor: c.SURFACE }]}>
        <Avatar url={profile.avatar_url} name={profile.name} size={72} />
        <UserName
          name={profile.name}
          verified={profile.verified}
          role={profile.role}
          nameColor={profile.name_color}
          nameGradient={profile.name_gradient}
          subTier={profile.sub_tier ?? 0}
          style={[styles.name, { color: c.INK }]}
          numberOfLines={1}
        />
        <Text style={[styles.handle, { color: c.INK_SOFT }]}>@{profile.handle}</Text>
        {!!profile.bio && <Text style={[styles.bio, { color: c.INK }]}>{profile.bio}</Text>}

        <View style={styles.statsRow}>
          <StatBox value={posts.length} label="постов" />
          <StatBox
            value={profile.followers}
            label="подписчики"
            onPress={() => navigation.navigate("FollowList", { handle: profile.handle, kind: "followers" })}
          />
          <StatBox
            value={profile.following}
            label="подписки"
            onPress={() => navigation.navigate("FollowList", { handle: profile.handle, kind: "following" })}
          />
        </View>

        {isSelf ? (
          <TouchableOpacity
            style={[styles.editBtn, { backgroundColor: c.WARM, borderColor: `${c.ACCENT}40` }]}
            onPress={() => navigation.navigate("Settings")}
            activeOpacity={0.8}
          >
            <Feather name="edit-2" size={14} color={c.ACCENT} />
            <Text style={[styles.editBtnText, { color: c.ACCENT }]}>Редактировать профиль</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.followBtn, { backgroundColor: c.ACCENT }, profile.isFollowing && { backgroundColor: c.WARM, borderWidth: 1, borderColor: `${c.ACCENT}50` }]}
              onPress={toggleFollow}
              disabled={followBusy}
              activeOpacity={0.8}
            >
              {followBusy
                ? <ActivityIndicator color={profile.isFollowing ? c.ACCENT : "#fff"} size="small" />
                : <>
                    <Feather name={profile.isFollowing ? "user-check" : "user-plus"} size={14} color={profile.isFollowing ? c.ACCENT : "#fff"} />
                    <Text style={[styles.followBtnText, profile.isFollowing && { color: c.ACCENT }]}>
                      {profile.isFollowing ? "Вы подписаны" : "Подписаться"}
                    </Text>
                  </>
              }
            </TouchableOpacity>

            <TouchableOpacity style={[styles.dmBtn, { backgroundColor: c.WARM, borderColor: `${c.ACCENT}40` }]} onPress={openDm} disabled={dmBusy} activeOpacity={0.8}>
              {dmBusy
                ? <ActivityIndicator color={c.ACCENT} size="small" />
                : <>
                    <Feather name="message-circle" size={14} color={c.ACCENT} />
                    <Text style={[styles.dmBtnText, { color: c.ACCENT }]}>Написать</Text>
                  </>
              }
            </TouchableOpacity>
          </View>
        )}

        {/* Achievements */}
        <Achievements handle={profile?.handle} />

        {/* Tab switcher */}
        <View style={[styles.tabRow, { borderTopColor: c.LINE }]}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === "posts" && { borderBottomColor: c.ACCENT }]}
            onPress={() => setTab("posts")}
            activeOpacity={0.8}
          >
            <Feather name="grid" size={16} color={tab === "posts" ? c.ACCENT : c.INK_SOFT} />
            <Text style={[styles.tabBtnText, { color: tab === "posts" ? c.ACCENT : c.INK_SOFT }]}>Посты</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === "media" && { borderBottomColor: c.ACCENT }]}
            onPress={() => setTab("media")}
            activeOpacity={0.8}
          >
            <Feather name="image" size={16} color={tab === "media" ? c.ACCENT : c.INK_SOFT} />
            <Text style={[styles.tabBtnText, { color: tab === "media" ? c.ACCENT : c.INK_SOFT }]}>Медиа</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const topBar = (
    <View style={[styles.topBar, { backgroundColor: c.SURFACE, borderBottomColor: c.LINE }]}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
        <Feather name="arrow-left" size={22} color={c.ACCENT} />
      </TouchableOpacity>
      <Text style={[styles.topTitle, { color: c.INK }]} numberOfLines={1}>
        {profile ? `@${profile.handle}` : handle}
      </Text>
      <View style={{ width: 36 }} />
    </View>
  );

  if (!loading && tab === "media") {
    return (
      <View style={[styles.root, { paddingTop: insets.top, backgroundColor: c.BG }]}>
        {topBar}
        <FlatList
          data={media}
          keyExtractor={(item, i) => `${item.postId}-${i}`}
          numColumns={MEDIA_COL}
          ListHeaderComponent={<Header />}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => navigation.navigate("PostDetail", { post: item.post })}
              activeOpacity={0.85}
            >
              <Image
                source={{ uri: assetUrl(item.url) }}
                style={{ width: MEDIA_SIZE, height: MEDIA_SIZE }}
                resizeMode="cover"
              />
            </TouchableOpacity>
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.ACCENT} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={
            !loading && (
              <View style={styles.emptyWrap}>
                <Feather name="image" size={32} color={c.INK_SOFT} style={{ opacity: 0.4, marginBottom: 8 }} />
                <Text style={[styles.emptyText, { color: c.INK_SOFT }]}>Нет медиа</Text>
              </View>
            )
          }
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, backgroundColor: c.BG }]}>
      {topBar}
      <FlatList
        data={posts}
        keyExtractor={p => String(p.id)}
        ListHeaderComponent={<Header />}
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
          !loading && profile && (
            <View style={styles.emptyWrap}>
              <Text style={[styles.emptyText, { color: c.INK_SOFT }]}>Нет постов</Text>
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root:             { flex: 1 },
  topBar:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  backBtn:          { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  topTitle:         { fontSize: 15, fontWeight: "700", flex: 1, textAlign: "center" },
  loadingWrap:      { paddingTop: 80, alignItems: "center" },
  profileCard:      { alignItems: "center", paddingTop: 24, paddingHorizontal: 20, gap: 6 },
  name:             { fontSize: 20, fontWeight: "800", marginTop: 4 },
  handle:           { fontSize: 14 },
  bio:              { fontSize: 14.5, textAlign: "center", lineHeight: 21, marginTop: 4 },
  statsRow:         { flexDirection: "row", gap: 28, marginTop: 14 },
  statBox:          { alignItems: "center" },
  statNum:          { fontSize: 18, fontWeight: "800" },
  statLabel:        { fontSize: 12, marginTop: 2 },
  actionRow:        { flexDirection: "row", gap: 10, marginTop: 16 },
  followBtn:        { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 22, paddingVertical: 10, borderRadius: 24 },
  followBtnText:    { color: "#fff", fontWeight: "700", fontSize: 14 },
  dmBtn:            { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24, borderWidth: 1 },
  dmBtnText:        { fontWeight: "700", fontSize: 14 },
  editBtn:          { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 16, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 24, borderWidth: 1 },
  editBtnText:      { fontWeight: "700", fontSize: 14 },
  tabRow:           { flexDirection: "row", width: "100%", borderTopWidth: 1, marginTop: 16 },
  tabBtn:           { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabBtnText:       { fontSize: 14, fontWeight: "600" },
  emptyWrap:        { alignItems: "center", paddingTop: 40 },
  emptyText:        { fontSize: 15 },
});
