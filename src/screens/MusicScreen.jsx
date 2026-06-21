import { useState, useEffect, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  ActivityIndicator, RefreshControl, Image, Alert, Modal,
  TextInput, ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import Feather from "@expo/vector-icons/Feather";
import { api, assetUrl } from "../lib/api.js";
import { globalPlayer } from "../lib/globalPlayer.js";
import { usePlayerStore } from "../store/player.js";
import { haptic } from "../lib/haptics.js";
import { useTheme } from "../store/theme.js";
import { useAuthStore } from "../store/auth.js";
import * as FileSystem from "expo-file-system/legacy";
import { API_BASE } from "../config.js";

function fmt(sec) {
  if (!sec || isNaN(sec)) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Upload modal ────────────────────────────────────────────────
function UploadModal({ visible, onClose, onUploaded, c }) {
  const [audioFile, setAudioFile] = useState(null);
  const [coverFile, setCoverFile] = useState(null);
  const [title, setTitle]         = useState("");
  const [artist, setArtist]       = useState("");
  const [loading, setLoading]     = useState(false);
  const token = useAuthStore(s => s.token);

  const reset = () => { setAudioFile(null); setCoverFile(null); setTitle(""); setArtist(""); };

  const pickAudio = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: "audio/*", copyToCacheDirectory: true });
    if (!res.canceled && res.assets?.[0]) {
      const f = res.assets[0];
      setAudioFile(f);
      if (!title) setTitle(f.name.replace(/\.[^.]+$/, ""));
    }
  };

  const pickCover = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
    if (!res.canceled && res.assets?.[0]) setCoverFile(res.assets[0]);
  };

  const submit = async () => {
    if (!audioFile) return Alert.alert("Выбери аудиофайл");
    if (!title.trim()) return Alert.alert("Введи название трека");
    setLoading(true);
    try {
      // Audio — use FileSystem.uploadAsync
      const audioResult = await FileSystem.uploadAsync(
        `${API_BASE}/api/tracks/upload`,
        audioFile.uri,
        {
          fieldName: "audio",
          httpMethod: "POST",
          uploadType: FileSystem?.FileSystemUploadType?.MULTIPART ?? 1,
          headers: { Authorization: `Bearer ${token}` },
          mimeType: audioFile.mimeType || "audio/mpeg",
          parameters: { title: title.trim(), artist: artist.trim(), public: "1" },
        }
      );
      if (audioResult.status < 200 || audioResult.status >= 300) throw new Error(`HTTP ${audioResult.status}`);

      // Cover — upload separately if selected
      let coverFailed = false;
      if (coverFile) {
        const body = JSON.parse(audioResult.body);
        const trackId = body.id;
        if (trackId) {
          const coverResult = await FileSystem.uploadAsync(
            `${API_BASE}/api/tracks/${trackId}/cover`,
            coverFile.uri,
            {
              fieldName: "cover",
              httpMethod: "POST",
              uploadType: FileSystem?.FileSystemUploadType?.MULTIPART ?? 1,
              headers: { Authorization: `Bearer ${token}` },
              mimeType: "image/jpeg",
            }
          ).catch(() => null);
          if (!coverResult || coverResult.status < 200 || coverResult.status >= 300) {
            coverFailed = true;
          }
        }
      }

      haptic.success();
      reset();
      onUploaded();
      onClose();
      if (coverFailed) Alert.alert("Трек загружен", "Но обложку загрузить не удалось — можно добавить позже.");
    } catch (e) {
      Alert.alert("Ошибка загрузки", e.message);
    } finally { setLoading(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <ScrollView style={{ flex: 1, backgroundColor: c.BG }} contentContainerStyle={{ padding: 20, gap: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <Text style={{ fontSize: 20, fontWeight: "800", color: c.INK }}>Загрузить трек</Text>
          <TouchableOpacity onPress={onClose}><Feather name="x" size={22} color={c.INK_SOFT} /></TouchableOpacity>
        </View>

        {/* Audio file */}
        <TouchableOpacity onPress={pickAudio} style={[up.btn, { borderColor: audioFile ? c.ACCENT : c.LINE, backgroundColor: c.SURFACE }]}>
          <Feather name="music" size={20} color={audioFile ? c.ACCENT : c.INK_SOFT} />
          <Text style={{ color: audioFile ? c.ACCENT : c.INK_SOFT, fontWeight: "600", flex: 1 }} numberOfLines={1}>
            {audioFile ? audioFile.name : "Выбрать аудиофайл (mp3, m4a, ogg...)"}
          </Text>
        </TouchableOpacity>

        {/* Cover */}
        <TouchableOpacity onPress={pickCover} style={[up.btn, { borderColor: coverFile ? c.ACCENT : c.LINE, backgroundColor: c.SURFACE }]}>
          <Feather name="image" size={20} color={coverFile ? c.ACCENT : c.INK_SOFT} />
          <Text style={{ color: coverFile ? c.ACCENT : c.INK_SOFT, fontWeight: "600" }}>
            {coverFile ? "Обложка выбрана" : "Выбрать обложку (необязательно)"}
          </Text>
          {coverFile && <Image source={{ uri: coverFile.uri }} style={{ width: 36, height: 36, borderRadius: 6 }} />}
        </TouchableOpacity>

        {/* Title */}
        <View>
          <Text style={{ color: c.INK_SOFT, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>НАЗВАНИЕ *</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Название трека"
            placeholderTextColor={c.INK_SOFT}
            style={[up.input, { color: c.INK, backgroundColor: c.SURFACE, borderColor: c.LINE }]}
          />
        </View>

        {/* Artist */}
        <View>
          <Text style={{ color: c.INK_SOFT, fontSize: 12, fontWeight: "600", marginBottom: 6 }}>ИСПОЛНИТЕЛЬ</Text>
          <TextInput
            value={artist}
            onChangeText={setArtist}
            placeholder="Исполнитель (необязательно)"
            placeholderTextColor={c.INK_SOFT}
            style={[up.input, { color: c.INK, backgroundColor: c.SURFACE, borderColor: c.LINE }]}
          />
        </View>

        <TouchableOpacity
          onPress={submit}
          disabled={loading || !audioFile}
          style={[up.submit, { backgroundColor: (!audioFile || loading) ? `${c.ACCENT}55` : c.ACCENT }]}
        >
          {loading
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={{ color: "#fff", fontWeight: "700", fontSize: 16 }}>Загрузить</Text>
          }
        </TouchableOpacity>
      </ScrollView>
    </Modal>
  );
}

const up = StyleSheet.create({
  btn:    { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, borderRadius: 14, borderWidth: 1 },
  input:  { padding: 14, borderRadius: 12, borderWidth: 1, fontSize: 15 },
  submit: { padding: 16, borderRadius: 14, alignItems: "center" },
});

// ─── Track card ─────────────────────────────────────────────────
function TrackCard({ track, isActive, isPlaying, onPlay, onLike }) {
  const c = useTheme();
  return (
    <TouchableOpacity
      style={[st.card, { backgroundColor: c.SURFACE, borderColor: isActive ? c.ACCENT : c.LINE }]}
      onPress={() => onPlay(track)}
      activeOpacity={0.8}
    >
      <View style={st.cardCoverWrap}>
        {track.coverUrl
          ? <Image source={{ uri: assetUrl(track.coverUrl) }} style={st.cardCover} />
          : (
            <View style={[st.cardCover, { backgroundColor: `${c.ACCENT}18`, alignItems: "center", justifyContent: "center" }]}>
              <Feather name="music" size={20} color={c.ACCENT} />
            </View>
          )
        }
        {isActive && (
          <View style={[st.cardPlayOverlay, { backgroundColor: `${c.ACCENT}cc` }]}>
            <Feather name={isPlaying ? "pause" : "play"} size={16} color="#fff" />
          </View>
        )}
      </View>
      <View style={st.cardInfo}>
        <Text style={[st.cardTitle, { color: c.INK }]} numberOfLines={1}>{track.title}</Text>
        <Text style={[st.cardArtist, { color: c.INK_SOFT }]} numberOfLines={1}>
          {track.artist || track.uploaderName || "Неизвестный"}
        </Text>
        <View style={st.cardMeta}>
          <Feather name="clock" size={11} color={c.INK_SOFT} />
          <Text style={[st.cardMetaText, { color: c.INK_SOFT }]}>{fmt(track.duration)}</Text>
          <Feather name="headphones" size={11} color={c.INK_SOFT} style={{ marginLeft: 8 }} />
          <Text style={[st.cardMetaText, { color: c.INK_SOFT }]}>{track.playCount || 0}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={() => onLike(track)} style={st.cardLikeBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Feather name="heart" size={18} color={track.liked ? "#e05a5a" : c.INK_SOFT} />
        {(track.likeCount > 0) && (
          <Text style={[st.cardLikeCount, { color: track.liked ? "#e05a5a" : c.INK_SOFT }]}>{track.likeCount}</Text>
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

// ─── Main screen ─────────────────────────────────────────────────
export default function MusicScreen({ navigation }) {
  const insets  = useSafeAreaInsets();
  const c       = useTheme();

  const [tab, setTab]               = useState("feed");
  const [tracks, setTracks]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const currentTrack = usePlayerStore(s => s.track);
  const isPlaying    = usePlayerStore(s => s.isPlaying);

  const ENDPOINTS = { feed: "/tracks/feed", my: "/tracks/my", liked: "/tracks/liked" };

  const load = useCallback(async (t = tab, isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    try {
      const data = await api(ENDPOINTS[t]);
      setTracks(Array.isArray(data) ? data : []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [tab]);

  useEffect(() => { load(tab); }, [tab]);

  const playTrack = async (track) => {
    try {
      await globalPlayer.play(track);
      api(`/tracks/${track.id}/play`, { method: "POST" }).catch(() => {});
    } catch (e) {
      Alert.alert("Ошибка воспроизведения", e.message || "Не удалось воспроизвести трек");
    }
  };

  const likeTrack = async (track) => {
    haptic.light();
    const wasLiked = track.liked;
    setTracks(prev => prev.map(t => t.id === track.id
      ? { ...t, liked: !wasLiked, likeCount: (t.likeCount || 0) + (wasLiked ? -1 : 1) }
      : t
    ));
    try {
      await api(`/tracks/${track.id}/like`, { method: "POST" });
    } catch {
      setTracks(prev => prev.map(t => t.id === track.id
        ? { ...t, liked: wasLiked, likeCount: (t.likeCount || 0) + (wasLiked ? 1 : -1) }
        : t
      ));
    }
  };

  const TABS = [
    { id: "feed", label: "Лента", icon: "radio" },
    { id: "liked", label: "Понравилось", icon: "heart" },
    { id: "my", label: "Мои треки", icon: "user" },
  ];

  return (
    <View style={[st.root, { backgroundColor: c.BG }]}>
      {/* Header */}
      <View style={[st.header, { paddingTop: insets.top + 6, backgroundColor: c.SURFACE, borderBottomColor: c.LINE }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={c.ACCENT} />
        </TouchableOpacity>
        <Text style={[st.title, { color: c.INK }]}>Музыка</Text>
        <TouchableOpacity onPress={() => setShowUpload(true)} style={st.backBtn} activeOpacity={0.7}>
          <Feather name="upload" size={20} color={c.ACCENT} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={[st.tabBar, { backgroundColor: c.SURFACE, borderBottomColor: c.LINE }]}>
        {TABS.map(t => (
          <TouchableOpacity
            key={t.id}
            style={[st.tabBtn, tab === t.id && { borderBottomColor: c.ACCENT }]}
            onPress={() => setTab(t.id)}
            activeOpacity={0.8}
          >
            <Feather name={t.icon} size={14} color={tab === t.id ? c.ACCENT : c.INK_SOFT} />
            <Text style={[st.tabLabel, { color: tab === t.id ? c.ACCENT : c.INK_SOFT }]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      {loading ? (
        <View style={st.center}><ActivityIndicator color={c.ACCENT} size="large" /></View>
      ) : (
        <FlatList
          data={tracks}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <TrackCard
              track={item}
              isActive={currentTrack?.id === item.id}
              isPlaying={currentTrack?.id === item.id && isPlaying}
              onPlay={playTrack}
              onLike={likeTrack}
            />
          )}
          contentContainerStyle={[st.list, { paddingBottom: insets.bottom + 16 }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load(tab, true)} tintColor={c.ACCENT} />}
          ListEmptyComponent={
            <View style={st.empty}>
              <Feather name="music" size={38} color={c.INK_SOFT} style={{ opacity: 0.4 }} />
              <Text style={[st.emptyText, { color: c.INK_SOFT }]}>
                {tab === "feed" ? "Нет треков" : tab === "liked" ? "Нет понравившихся треков" : "Нет загруженных треков"}
              </Text>
              {tab === "my" && (
                <TouchableOpacity onPress={() => setShowUpload(true)} style={[st.uploadBtn, { backgroundColor: c.ACCENT }]}>
                  <Feather name="upload" size={15} color="#fff" />
                  <Text style={{ color: "#fff", fontWeight: "700" }}>Загрузить трек</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}

      <UploadModal
        visible={showUpload}
        onClose={() => setShowUpload(false)}
        onUploaded={() => tab === "my" && load("my", true)}
        c={c}
      />
    </View>
  );
}

const st = StyleSheet.create({
  root:      { flex: 1 },
  header:    { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn:   { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title:     { fontSize: 17, fontWeight: "800" },
  center:    { flex: 1, alignItems: "center", justifyContent: "center" },
  tabBar:    { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  tabBtn:    { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 11, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabLabel:  { fontSize: 13, fontWeight: "600" },
  list:      { padding: 12, gap: 10 },
  empty:     { alignItems: "center", paddingTop: 60, gap: 12 },
  emptyText: { fontSize: 15, fontWeight: "600" },
  uploadBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12 },
  card:           { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, padding: 12, borderWidth: StyleSheet.hairlineWidth },
  cardCoverWrap:  { position: "relative" },
  cardCover:      { width: 52, height: 52, borderRadius: 10 },
  cardPlayOverlay:{ position: "absolute", inset: 0, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  cardInfo:       { flex: 1, gap: 2 },
  cardTitle:      { fontSize: 14.5, fontWeight: "700" },
  cardArtist:     { fontSize: 12.5 },
  cardMeta:       { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  cardMetaText:   { fontSize: 11 },
  cardLikeBtn:    { alignItems: "center", gap: 2, padding: 6 },
  cardLikeCount:  { fontSize: 11, fontWeight: "600" },
});
