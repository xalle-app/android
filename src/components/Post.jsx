import { useState, useRef, memo, useMemo, useCallback, useEffect } from "react";
import {
  View, Text, Image, TouchableOpacity, StyleSheet, TextInput,
  ScrollView, Dimensions, Animated, Alert, Share, Modal, PanResponder, ActivityIndicator,
} from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import * as Clipboard from "expo-clipboard";
import Feather from "@expo/vector-icons/Feather";
import Avatar from "./Avatar.jsx";
import UserName from "./UserName.jsx";
import MarkdownText from "./MarkdownText.jsx";
import PollCard from "./PollCard.jsx";
import Lightbox from "./Lightbox.jsx";
import ReportDialog from "./ReportDialog.jsx";
import { api, assetUrl } from "../lib/api.js";
import { haptic } from "../lib/haptics.js";
import { timeAgo } from "../lib/format.js";
import { API_BASE } from "../config.js";
import { useTheme } from "../store/theme.js";

const SCREEN_W = Dimensions.get("window").width;
const COLLAPSE_LEN = 500;

const REACTIONS = ["❤️", "👍", "😂", "😮", "😢", "🔥", "👎", "🫶"];

// Returns { images: string[], videos: string[] }
function parseMedia(raw) {
  if (!raw) return { images: [], videos: [] };
  try {
    const arr = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!Array.isArray(arr)) return { images: [], videos: [] };
    const images = [], videos = [];
    for (const item of arr) {
      const url  = typeof item === "string" ? item : item?.url;
      const type = typeof item === "object" ? item?.type : null;
      if (!url) continue;
      if (type === "video" || url.match(/\.(mp4|webm|mov)(\?|$)/i)) videos.push(url);
      else images.push(url);
    }
    return { images, videos };
  } catch { return { images: [], videos: [] }; }
}

function VideoItem({ url }) {
  const [isPlaying, setIsPlaying] = useState(false);
  
  const player = useVideoPlayer(assetUrl(url), player => {
    player.loop = false;
  });

  const togglePlay = () => {
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    const subscription = player.addListener('playingChange', (event) => {
      setIsPlaying(event.isPlaying);
    });
    return () => subscription.remove();
  }, [player]);

  return (
    <View style={styles.videoWrap}>
      <VideoView
        player={player}
        style={styles.video}
        nativeControls={false}
        allowsFullscreen={false}
      />
      <TouchableOpacity
        style={styles.videoOverlay}
        activeOpacity={0.85}
        onPress={togglePlay}
      >
        {!isPlaying && (
          <View style={styles.playBtn}>
            <Feather name="play" size={26} color="#fff" />
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

function ImageGallery({ images, onPress }) {
  if (!images.length) return null;
  if (images.length === 1) {
    return (
      <TouchableOpacity onPress={() => onPress(0)} activeOpacity={0.92}>
        <Image source={{ uri: assetUrl(images[0]) }} style={styles.singleImg} resizeMode="cover" />
      </TouchableOpacity>
    );
  }
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gallery}>
      {images.map((img, i) => (
        <TouchableOpacity key={i} onPress={() => onPress(i)} activeOpacity={0.92}>
          <Image source={{ uri: assetUrl(img) }} style={styles.galleryImg} resizeMode="cover" />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function PostActionSheet({ visible, onClose, actions }) {
  const c   = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => g.dy > 8,
      onPanResponderRelease: (_, g) => {
        if (g.dy > 80 || g.vy > 1) onClose();
      },
    })
  ).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 11 }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    }
  }, [visible]);

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] });
  const opacity    = anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.5, 1] });

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.sheetBackdrop, { opacity }]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { backgroundColor: c.SURFACE, transform: [{ translateY }] }]} {...panResponder.panHandlers}>
        <View style={[styles.sheetHandle, { backgroundColor: c.LINE }]} />
        {actions.map((a, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.sheetItem, a.destructive && styles.sheetItemDanger]}
            activeOpacity={0.7}
            onPress={() => { onClose(); setTimeout(() => a.onPress?.(), 300); }}
          >
            <View style={[styles.sheetIcon, { backgroundColor: `${c.ACCENT}12` }, a.destructive && styles.sheetIconDanger]}>
              <Feather name={a.icon} size={17} color={a.destructive ? "#e05a5a" : c.ACCENT} />
            </View>
            <Text style={[styles.sheetItemText, { color: c.INK }, a.destructive && styles.sheetItemTextDanger]}>{a.label}</Text>
            <Feather name="chevron-right" size={15} color={a.destructive ? "#e05a5a60" : `${c.ACCENT}60`} />
          </TouchableOpacity>
        ))}
      </Animated.View>
    </Modal>
  );
}

function ReactionBar({ reactions, myReaction, onReact }) {
  const c = useTheme();
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const togglePicker = () => {
    const next = !open;
    setOpen(next);
    haptic.select();
    Animated.spring(anim, { toValue: next ? 1 : 0, useNativeDriver: false, tension: 90, friction: 12 }).start();
  };

  const pick = (emoji) => {
    haptic.light();
    onReact?.(emoji);
    setOpen(false);
    Animated.timing(anim, { toValue: 0, duration: 150, useNativeDriver: false }).start();
  };

  const counts = reactions?.counts || {};
  const active = REACTIONS.filter(e => (counts[e] || 0) > 0);
  const pickerW = anim.interpolate({ inputRange: [0, 1], outputRange: [0, REACTIONS.length * 36] });
  const pickerO = anim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0, 1] });

  return (
    <View style={styles.reactionOuter}>
      <View style={styles.reactionRow}>
        {active.map(emoji => {
          const n = counts[emoji];
          const isMe = myReaction === emoji;
          return (
            <TouchableOpacity
              key={emoji}
              style={[
                styles.chip,
                { backgroundColor: c.WARM, borderColor: c.LINE },
                isMe && { backgroundColor: `${c.ACCENT}15`, borderColor: `${c.ACCENT}45` },
              ]}
              onPress={() => pick(emoji)} activeOpacity={0.7}
            >
              <Text style={styles.chipEmoji}>{emoji}</Text>
              <Text style={[styles.chipCount, { color: isMe ? c.ACCENT : c.INK_SOFT }]}>{n}</Text>
            </TouchableOpacity>
          );
        })}
        {onReact && (
          <TouchableOpacity
            style={[styles.addBtn, { backgroundColor: c.WARM, borderColor: c.LINE }, open && { backgroundColor: `${c.ACCENT}14`, borderColor: c.ACCENT }]}
            onPress={togglePicker} activeOpacity={0.7}
          >
            <Feather name={open ? "x" : "smile"} size={13} color={open ? c.ACCENT : c.INK_SOFT} />
          </TouchableOpacity>
        )}
      </View>
      {onReact && (
        <Animated.View style={[styles.pickerRow, { width: pickerW, opacity: pickerO }]}>
          {REACTIONS.map(emoji => (
            <TouchableOpacity
              key={emoji}
              style={[styles.pickerBtn, { backgroundColor: c.WARM }, myReaction === emoji && { backgroundColor: `${c.ACCENT}20` }]}
              onPress={() => pick(emoji)} activeOpacity={0.65}
            >
              <Text style={styles.pickerEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </Animated.View>
      )}
    </View>
  );
}

function Post({ post, onPress, onReact, onAvatarPress, onDelete, onMentionPress, me, onUpdate }) {
  const c          = useTheme();
  const { images, videos } = useMemo(() => parseMedia(post.images), [post.images]);
  const myReaction = post.reactions?.userReaction ?? post.my_reaction ?? null;
  const isMine     = me && (post.handle === me.handle || post.user_id === me.id);
  const isLong     = (post.body?.length || 0) > COLLAPSE_LEN;

  const [expanded, setExpanded]       = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const [sheetOpen, setSheetOpen]     = useState(false);
  const [bookmarked, setBookmarked]   = useState(post.bookmarked ?? post.is_bookmarked ?? false);
  const [reportOpen, setReportOpen]   = useState(false);
  const [editMode, setEditMode]       = useState(false);
  const [editBody, setEditBody]       = useState(post.body || "");
  const [editBusy, setEditBusy]       = useState(false);
  const [currentBody, setCurrentBody] = useState(post.body || "");

  const sharePost = async () => {
    haptic.light();
    const url = `${API_BASE}/@${post.handle}/posts/${post.id}`;
    try { await Share.share({ message: `${post.body?.slice(0, 200) || ""}… ${url}`, url }); } catch {}
  };

  const copyLink = async () => {
    haptic.success();
    const url = `${API_BASE}/@${post.handle}/posts/${post.id}`;
    await Clipboard.setStringAsync(url);
    Alert.alert("Скопировано", "Ссылка скопирована в буфер обмена.");
  };

  const doRepost = async () => {
    try {
      haptic.success();
      await api(`/posts/${post.id}/repost`, { method: "POST" });
      Alert.alert("Готово", "Пост опубликован в твоей ленте.");
    } catch (e) { Alert.alert("Ошибка", e.message); }
  };

  const doDelete = async () => {
    Alert.alert("Удалить пост?", "Это действие нельзя отменить.", [
      { text: "Отмена", style: "cancel" },
      { text: "Удалить", style: "destructive", onPress: async () => {
        try { await api(`/posts/${post.id}`, { method: "DELETE" }); onDelete?.(post.id); haptic.success(); }
        catch { Alert.alert("Ошибка", "Не удалось удалить пост."); }
      }},
    ]);
  };

  const doReport = () => { haptic.light(); setSheetOpen(false); setTimeout(() => setReportOpen(true), 320); };

  const startEdit = () => {
    setEditBody(currentBody);
    setEditMode(true);
    haptic.light();
  };

  const cancelEdit = () => {
    setEditMode(false);
    setEditBody(currentBody);
  };

  const saveEdit = async () => {
    const trimmed = editBody.trim();
    if (!trimmed) return;
    setEditBusy(true);
    try {
      await api(`/posts/${post.id}`, { method: "PATCH", body: { body: trimmed } });
      setCurrentBody(trimmed);
      setEditMode(false);
      haptic.success();
      onUpdate?.(post.id, trimmed);
    } catch (e) {
      Alert.alert("Ошибка", e.message || "Не удалось сохранить");
    }
    setEditBusy(false);
  };

  const toggleBookmark = async () => {
    const next = !bookmarked;
    setBookmarked(next);
    haptic.light();
    try {
      if (next) {
        await api(`/v2/bookmarks/${post.id}`, { method: "POST" });
      } else {
        await api(`/v2/bookmarks/${post.id}`, { method: "DELETE" });
      }
    } catch { setBookmarked(!next); }
  };

  const sheetActions = isMine
    ? [
        { icon: "edit-2",     label: "Редактировать",      onPress: startEdit },
        { icon: "trash-2",    label: "Удалить пост",        onPress: doDelete,        destructive: true },
        { icon: "bookmark",   label: bookmarked ? "Убрать из закладок" : "Сохранить", onPress: toggleBookmark },
        { icon: "share-2",    label: "Поделиться",           onPress: sharePost },
        { icon: "link",       label: "Скопировать ссылку",   onPress: copyLink },
      ]
    : [
        { icon: "bookmark", label: bookmarked ? "Убрать из закладок" : "Сохранить", onPress: toggleBookmark },
        { icon: "repeat",     label: "Репостнуть",         onPress: doRepost },
        { icon: "share-2",    label: "Поделиться",         onPress: sharePost },
        { icon: "link",       label: "Скопировать ссылку", onPress: copyLink },
        { icon: "flag",       label: "Пожаловаться",       onPress: doReport,        destructive: true },
      ];

  const handleLongPress = () => {
    haptic.medium();
    setSheetOpen(true);
  };

  const displayBody = isLong && !expanded ? currentBody.slice(0, COLLAPSE_LEN) + "…" : currentBody;

  return (
    <>
      <TouchableOpacity activeOpacity={editMode ? 1 : 0.97} onPress={editMode ? undefined : onPress} onLongPress={editMode ? undefined : handleLongPress} delayLongPress={400}>
        <View style={[styles.card, { backgroundColor: c.SURFACE }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.8} disabled={!onAvatarPress}>
              <Avatar url={post.avatar_url} name={post.name} size={40} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.headerMid} onPress={onAvatarPress} activeOpacity={0.8} disabled={!onAvatarPress}>
              <UserName
                name={post.name} verified={post.verified} role={post.role}
                nameColor={post.name_color} nameGradient={post.name_gradient}
                subTier={post.subscription_tier} style={styles.nameStyle}
              />
              <Text style={[styles.handle, { color: c.INK_SOFT }]}>@{post.handle} · {timeAgo(post.created_at)}</Text>
            </TouchableOpacity>
            {post.whisper && (
              <View style={[styles.whisperBadge, { backgroundColor: c.WARM }]}>
                <Feather name="lock" size={11} color={c.INK_SOFT} />
              </View>
            )}
          </View>

          {/* Edit mode */}
          {editMode ? (
            <View style={styles.editWrap}>
              <TextInput
                style={[styles.editInput, { backgroundColor: c.WARM, color: c.INK, borderColor: c.ACCENT }]}
                value={editBody}
                onChangeText={setEditBody}
                multiline
                autoFocus
                maxLength={15000}
              />
              <View style={styles.editActions}>
                <TouchableOpacity style={[styles.editBtn, { backgroundColor: c.WARM }]} onPress={cancelEdit} disabled={editBusy}>
                  <Text style={[styles.editBtnText, { color: c.INK_SOFT }]}>Отмена</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.editBtn, { backgroundColor: c.ACCENT }]} onPress={saveEdit} disabled={editBusy || !editBody.trim()}>
                  {editBusy
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={[styles.editBtnText, { color: "#fff" }]}>Сохранить</Text>}
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            /* Body */
            !!currentBody && (
              <>
                <MarkdownText style={[styles.bodyStyle, { color: c.INK }]} onMentionPress={onMentionPress}>
                  {displayBody}
                </MarkdownText>
                {isLong && (
                  <TouchableOpacity
                    onPress={(e) => { e.stopPropagation?.(); setExpanded(v => !v); haptic.light(); }}
                    style={styles.readMore}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.readMoreText, { color: c.ACCENT }]}>{expanded ? "Свернуть" : "Читать далее"}</Text>
                    <Feather name={expanded ? "chevron-up" : "chevron-down"} size={13} color={c.ACCENT} />
                  </TouchableOpacity>
                )}
              </>
            )
          )}

          {/* Poll */}
          {!!post.poll && (
            <PollCard poll={post.poll} postId={post.id} isMine={isMine} />
          )}

          {/* Images */}
          <ImageGallery images={images} onPress={i => setLightboxIdx(i)} />

          {/* Videos */}
          {videos.map((url, i) => <VideoItem key={i} url={url} />)}

          {/* Repost indicator */}
          {post.repost_from && (
            <View style={[styles.repostBadge, { backgroundColor: c.WARM }]}>
              <Feather name="repeat" size={11} color={c.INK_SOFT} />
              <Text style={[styles.repostText, { color: c.INK_SOFT }]}>репост</Text>
            </View>
          )}

          {/* Footer */}
          <View style={styles.footer}>
            <ReactionBar reactions={post.reactions} myReaction={myReaction} onReact={onReact} />
            <View style={styles.stats}>
              {post.comments > 0 && (
                <View style={styles.stat}>
                  <Feather name="message-circle" size={13} color={c.INK_SOFT} />
                  <Text style={[styles.statText, { color: c.INK_SOFT }]}>{post.comments}</Text>
                </View>
              )}
              {post.reposts > 0 && (
                <View style={styles.stat}>
                  <Feather name="repeat" size={13} color={c.INK_SOFT} />
                  <Text style={[styles.statText, { color: c.INK_SOFT }]}>{post.reposts}</Text>
                </View>
              )}
              {post.views > 0 && (
                <View style={styles.stat}>
                  <Feather name="eye" size={13} color={c.INK_SOFT} />
                  <Text style={[styles.statText, { color: c.INK_SOFT }]}>{post.views}</Text>
                </View>
              )}
            </View>
          </View>
        </View>
        <View style={[styles.divider, { backgroundColor: c.LINE }]} />
      </TouchableOpacity>

      {/* Lightbox */}
      <Lightbox
        images={images}
        initialIndex={lightboxIdx ?? 0}
        visible={lightboxIdx !== null}
        onClose={() => setLightboxIdx(null)}
      />

      {/* Action sheet */}
      <PostActionSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        actions={sheetActions}
      />

      {/* Report dialog */}
      <ReportDialog
        visible={reportOpen}
        onClose={() => setReportOpen(false)}
        targetType="post"
        targetId={post.id}
      />
    </>
  );
}

export default memo(Post);

const styles = StyleSheet.create({
  card:          { paddingHorizontal: 16, paddingTop: 15, paddingBottom: 13 },
  divider:       { height: StyleSheet.hairlineWidth },

  header:        { flexDirection: "row", alignItems: "flex-start", gap: 11, marginBottom: 10 },
  headerMid:     { flex: 1 },
  nameStyle:     { fontSize: 14.5, fontWeight: "700" },
  handle:        { fontSize: 12.5, marginTop: 2 },
  whisperBadge:  { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },

  bodyStyle:     { fontSize: 15.5, lineHeight: 23, marginBottom: 8 },
  readMore:      { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 8 },
  readMoreText:  { fontSize: 13.5, fontWeight: "600" },

  singleImg:     { width: "100%", height: 230, borderRadius: 16, marginBottom: 10, overflow: "hidden" },
  gallery:       { marginBottom: 10 },
  galleryImg:    { width: SCREEN_W * 0.72, height: 210, borderRadius: 16, marginRight: 8 },

  videoWrap:     { width: "100%", height: 230, borderRadius: 16, marginBottom: 10, overflow: "hidden", backgroundColor: "#000" },
  video:         { width: "100%", height: "100%" },
  videoOverlay:  { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  playBtn:       { width: 56, height: 56, borderRadius: 28, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" },

  repostBadge:   { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 6, alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  repostText:    { fontSize: 12 },

  reactionOuter: { flex: 1 },
  reactionRow:   { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5 },

  chip:          { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth },
  chipEmoji:     { fontSize: 14 },
  chipCount:     { fontSize: 12, fontWeight: "600" },
  addBtn:        { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", borderWidth: StyleSheet.hairlineWidth },

  pickerRow:     { flexDirection: "row", alignItems: "center", overflow: "hidden", marginTop: 6 },
  pickerBtn:     { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", marginRight: 2 },
  pickerEmoji:   { fontSize: 20 },

  footer:        { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 10 },
  stats:         { flexDirection: "row", gap: 14, paddingTop: 2 },
  stat:          { flexDirection: "row", alignItems: "center", gap: 4 },
  statText:      { fontSize: 12.5 },

  editWrap:            { marginBottom: 8 },
  editInput:           { borderWidth: 1.5, borderRadius: 12, padding: 12, fontSize: 15, lineHeight: 22, minHeight: 80, textAlignVertical: "top" },
  editActions:         { flexDirection: "row", gap: 8, marginTop: 8, justifyContent: "flex-end" },
  editBtn:             { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20 },
  editBtnText:         { fontSize: 14, fontWeight: "700" },

  sheetBackdrop:       { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 10 },
  sheet:               { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 40, paddingTop: 8, zIndex: 20, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 28, shadowOffset: { width: 0, height: -4 }, elevation: 28 },
  sheetHandle:         { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 18 },
  sheetItem:           { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 14 },
  sheetItemDanger:     {},
  sheetIcon:           { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  sheetIconDanger:     { backgroundColor: "#e05a5a14" },
  sheetItemText:       { flex: 1, fontSize: 15.5, fontWeight: "600" },
  sheetItemTextDanger: { color: "#e05a5a" },
});
