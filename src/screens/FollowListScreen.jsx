import { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import Avatar from "../components/Avatar.jsx";
import UserName from "../components/UserName.jsx";
import { api } from "../lib/api.js";
import { haptic } from "../lib/haptics.js";
import { useAuthStore } from "../store/auth.js";
import { useTheme } from "../store/theme.js";

function UserRow({ u, me, navigation }) {
  const c = useTheme();
  const isSelf = me?.handle === u.handle;
  const [following, setFollowing] = useState(!!u.is_following);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy || isSelf) return;
    setBusy(true);
    haptic.light();
    const next = !following;
    setFollowing(next);
    try {
      await api(`/follow/${u.handle}`, { method: next ? "POST" : "DELETE" });
    } catch {
      setFollowing(!next);
    }
    setBusy(false);
  };

  return (
    <TouchableOpacity
      style={[st.row, { backgroundColor: c.SURFACE }]}
      onPress={() => navigation.push("UserProfile", { handle: u.handle })}
      activeOpacity={0.8}
    >
      <Avatar url={u.avatar_url} name={u.name} size={44} />
      <View style={st.info}>
        <UserName
          name={u.name}
          verified={u.verified}
          role={u.role}
          nameColor={u.name_color}
          nameGradient={u.name_gradient}
          subTier={u.subscription_tier ?? 0}
          style={st.name}
        />
        <Text style={[st.handle, { color: c.INK_SOFT }]}>@{u.handle}</Text>
        {!!u.bio && <Text style={[st.bio, { color: c.INK_SOFT }]} numberOfLines={1}>{u.bio}</Text>}
      </View>

      {!isSelf && (
        <TouchableOpacity
          style={[st.followBtn, { backgroundColor: c.ACCENT }, following && { backgroundColor: c.WARM, borderWidth: 1, borderColor: `${c.ACCENT}50` }]}
          onPress={toggle}
          disabled={busy}
          activeOpacity={0.8}
        >
          {busy
            ? <ActivityIndicator size="small" color={following ? c.ACCENT : "#fff"} />
            : <Text style={[st.followBtnText, following && { color: c.ACCENT }]}>
                {following ? "Подписан" : "Подписаться"}
              </Text>
          }
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

export default function FollowListScreen({ route, navigation }) {
  const { handle, kind } = route.params;
  const insets = useSafeAreaInsets();
  const me = useAuthStore(s => s.user);
  const c = useTheme();

  const [list, setList]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const title = kind === "followers" ? "Подписчики" : "Подписки";

  const load = useCallback(async () => {
    try {
      const data = await api(`/profile/${handle}/${kind}`);
      setList(Array.isArray(data) ? data : []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [handle, kind]);

  useEffect(() => { load(); }, []);

  return (
    <View style={[st.root, { paddingTop: insets.top, backgroundColor: c.BG }]}>
      <View style={[st.header, { backgroundColor: c.SURFACE, borderBottomColor: c.LINE }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={c.ACCENT} />
        </TouchableOpacity>
        <Text style={[st.title, { color: c.INK }]}>{title} @{handle}</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={st.center}><ActivityIndicator color={c.ACCENT} size="large" /></View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={u => String(u.id)}
          renderItem={({ item }) => <UserRow u={item} me={me} navigation={navigation} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={c.ACCENT} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          ItemSeparatorComponent={() => <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: c.LINE, marginLeft: 70 }} />}
          ListEmptyComponent={
            <View style={st.empty}>
              <Feather name="users" size={36} color={c.INK_SOFT} style={{ opacity: 0.4, marginBottom: 10 }} />
              <Text style={[st.emptyText, { color: c.INK_SOFT }]}>{kind === "followers" ? "Нет подписчиков" : "Нет подписок"}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root:             { flex: 1 },
  header:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn:          { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title:            { fontSize: 15, fontWeight: "700", flex: 1, textAlign: "center" },
  center:           { flex: 1, alignItems: "center", justifyContent: "center" },
  row:              { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  info:             { flex: 1 },
  name:             { fontSize: 14.5, fontWeight: "700" },
  handle:           { fontSize: 12.5, marginTop: 1 },
  bio:              { fontSize: 12.5, marginTop: 3 },
  followBtn:        { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, minWidth: 100, alignItems: "center" },
  followBtnText:    { color: "#fff", fontWeight: "700", fontSize: 13 },
  empty:            { alignItems: "center", paddingTop: 80 },
  emptyText:        { fontSize: 15 },
});
