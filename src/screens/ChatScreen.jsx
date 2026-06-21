import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image, Animated, Alert, Share, Keyboard, Modal,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Audio } from "expo-av";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import Avatar from "../components/Avatar.jsx";
import Lightbox from "../components/Lightbox.jsx";
import ForwardModal from "../components/ForwardModal.jsx";
import { api, assetUrl } from "../lib/api.js";
import { uploadAssets, uploadVoiceAsset } from "../lib/upload.js";
import { haptic } from "../lib/haptics.js";
import { useAuthStore } from "../store/auth.js";
import { wsOn, ws } from "../lib/ws.js";
import { useTheme } from "../store/theme.js";

function fmtTime(dt) {
  if (!dt) return "";
  const d = new Date(dt.replace(" ", "T") + (dt.includes("T") ? "" : "Z"));
  return d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(dt) {
  if (!dt) return "";
  const d = new Date(dt.replace(" ", "T") + (dt.includes("T") ? "" : "Z"));
  const today = new Date();
  const yest  = new Date(today); yest.setDate(yest.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Сегодня";
  if (d.toDateString() === yest.toDateString())  return "Вчера";
  return d.toLocaleDateString("ru", { day: "numeric", month: "long" });
}

function DateSep({ date }) {
  const c = useTheme();
  return (
    <View style={styles.dateSep}>
      <View style={[styles.dateLine, { backgroundColor: c.LINE }]} />
      <Text style={[styles.dateText, { color: c.INK_SOFT }]}>{date}</Text>
      <View style={[styles.dateLine, { backgroundColor: c.LINE }]} />
    </View>
  );
}

function ReadStatus({ msg, isMe }) {
  const c = useTheme();
  if (!isMe) return null;
  const read = !!msg.read_at;
  return (
    <View style={styles.readStatus}>
      <Feather name="check" size={11} color={read ? c.ACCENT : "rgba(255,255,255,0.5)"} />
      {read && <Feather name="check" size={11} color={c.ACCENT} style={{ marginLeft: -6 }} />}
    </View>
  );
}

function VoicePlayer({ url }) {
  const c = useTheme();
  const soundRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [pos, setPos]         = useState(0);
  const [dur, setDur]         = useState(0);

  useEffect(() => {
    return () => { soundRef.current?.unloadAsync().catch(() => {}); };
  }, []);

  const toggle = async () => {
    try {
      if (!soundRef.current) {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const token = useAuthStore.getState().token;
        const { sound, status } = await Audio.Sound.createAsync(
          { uri: assetUrl(url), headers: token ? { Authorization: `Bearer ${token}` } : undefined },
          { shouldPlay: true },
          (s) => {
            if (s.isLoaded) {
              setPos(s.positionMillis || 0);
              setDur(s.durationMillis || 0);
              if (s.didJustFinish) { setPlaying(false); setPos(0); }
            }
          }
        );
        soundRef.current = sound;
        setPlaying(true);
      } else if (playing) {
        await soundRef.current.pauseAsync();
        setPlaying(false);
      } else {
        await soundRef.current.playAsync();
        setPlaying(true);
      }
    } catch {}
  };

  const fmtMs = (ms) => {
    const s = Math.floor((ms || 0) / 1000);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  const progress = dur > 0 ? pos / dur : 0;

  return (
    <View style={styles.voiceRow}>
      <TouchableOpacity onPress={toggle} style={[styles.voicePlayBtn, { backgroundColor: `${c.ACCENT}22` }]}>
        <Feather name={playing ? "pause" : "play"} size={14} color={c.ACCENT} />
      </TouchableOpacity>
      <View style={[styles.voiceBar, { backgroundColor: `${c.ACCENT}25` }]}>
        <View style={[styles.voiceFill, { width: `${progress * 100}%`, backgroundColor: c.ACCENT }]} />
      </View>
      <Text style={[styles.voiceTime, { color: c.INK_SOFT }]}>{dur > 0 ? fmtMs(pos) : "🎤"}</Text>
    </View>
  );
}

const MsgBubble = memo(function MsgBubble({ msg, isMe, showAvatar, conv, onReply, onEdit, onDelete, onForward, onLightbox, onLongPress }) {
  const c = useTheme();
  const images = useMemo(() => {
    if (!msg.images) return [];
    if (Array.isArray(msg.images)) return msg.images;
    try { return JSON.parse(msg.images); } catch { return []; }
  }, [msg.images]);

  return (
    <TouchableOpacity activeOpacity={0.85} onLongPress={() => onLongPress?.(msg)} delayLongPress={350}>
      <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
        {!isMe && showAvatar && <Avatar url={conv.other_avatar} name={conv.other_name} size={28} />}
        {!isMe && !showAvatar && <View style={{ width: 28 }} />}
        <View style={[styles.bubble, isMe ? [styles.bubbleMe, { backgroundColor: c.ACCENT }] : [styles.bubbleThem, { backgroundColor: c.SURFACE }], !showAvatar && !isMe && styles.bubbleCont]}>
          {/* Reply quote */}
          {msg.reply_body ? (
            <View style={[styles.replyQuote, { borderLeftColor: isMe ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.2)" }]}>
              <Text style={[styles.replyName, isMe ? styles.replyNameMe : { color: c.ACCENT }]} numberOfLines={1}>
                {msg.reply_sender_name || "Ответ"}
              </Text>
              <Text style={[styles.replyText, isMe ? styles.replyTextMe : { opacity: 0.7 }]} numberOfLines={2}>
                {msg.reply_body}
              </Text>
            </View>
          ) : null}

          {/* Forward indicator */}
          {msg.forwarded_from && (
            <Text style={[styles.forwardedLabel, isMe && styles.forwardedLabelMe]}>↪ Пересылка</Text>
          )}

          {/* Images */}
          {images.map((img, i) => (
            <TouchableOpacity key={i} onPress={() => onLightbox?.(images, i)}>
              <Image source={{ uri: assetUrl(img) }} style={styles.msgImg} resizeMode="cover" />
            </TouchableOpacity>
          ))}

          {/* Voice */}
          {msg.voice_url && <VoicePlayer url={msg.voice_url} />}

          {/* Text */}
          {!!msg.body && !msg.deleted_for_all && (
            <Text style={[styles.bubbleText, { color: isMe ? "#fff" : c.INK }]}>{msg.body}</Text>
          )}
          {msg.deleted_for_all ? (
            <Text style={[styles.bubbleText, styles.deletedText, { color: isMe ? "#fff" : c.INK }]}>
              <Feather name="slash" size={12} /> Удалено
            </Text>
          ) : null}

          <View style={styles.bubbleMeta}>
            {msg.edited_at && <Text style={[styles.editedText, isMe && styles.editedTextMe, !isMe && { color: c.INK_SOFT }]}>изм.</Text>}
            <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe, !isMe && { color: c.INK_SOFT }]}>{fmtTime(msg.created_at)}</Text>
            <ReadStatus msg={msg} isMe={isMe} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

// Animated reply bar
function ReplyBar({ replyTo, editMode, onCancel }) {
  const c = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  const active = replyTo || editMode;
  useEffect(() => {
    Animated.spring(anim, { toValue: active ? 1 : 0, useNativeDriver: false, tension: 80, friction: 11 }).start();
  }, [active]);
  const height = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 52] });
  return (
    <Animated.View style={[styles.replyBar, { height, overflow: "hidden", backgroundColor: `${c.ACCENT}0a`, borderTopColor: `${c.ACCENT}30` }]}>
      <View style={styles.replyBarInner}>
        <View style={[styles.replyBarAccent, { backgroundColor: editMode ? "#5a8be0" : c.ACCENT }]} />
        <View style={{ flex: 1 }}>
          <Text style={[styles.replyBarName, { color: editMode ? "#5a8be0" : c.ACCENT }]} numberOfLines={1}>
            {editMode ? "Редактирование" : (replyTo?.sender_name || "Ответ")}
          </Text>
          <Text style={[styles.replyBarText, { color: c.INK_SOFT }]} numberOfLines={1}>
            {editMode ? (editMode.body || "") : (replyTo?.body || "")}
          </Text>
        </View>
        <TouchableOpacity onPress={onCancel} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="x" size={18} color={c.INK_SOFT} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

function MsgActionSheet({ sheet, onClose, onReply, onEdit, onForward, onDelete }) {
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, { toValue: sheet ? 1 : 0, useNativeDriver: true, tension: 70, friction: 12 }).start();
  }, [!!sheet]);
  if (!sheet) return null;
  const { msg, isMe } = sheet;
  const actions = [
    { icon: "corner-down-right", label: "Ответить", onPress: () => onReply(msg) },
    { icon: "share-2", label: "Переслать", onPress: () => onForward(msg) },
    ...(isMe ? [
      { icon: "edit-2", label: "Редактировать", onPress: () => onEdit(msg) },
      { icon: "trash-2", label: "Удалить", danger: true, onPress: () => onDelete(msg) },
    ] : []),
  ];
  return (
    <Modal transparent animationType="none" visible={!!sheet} onRequestClose={onClose}>
      <TouchableOpacity style={msStyles.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[msStyles.sheet, { backgroundColor: c.SURFACE, paddingBottom: insets.bottom + 16 },
        { transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }] }]}>
        <View style={[msStyles.handle, { backgroundColor: c.LINE }]} />
        {actions.map((a, i) => (
          <TouchableOpacity key={i} style={[msStyles.action, { borderBottomColor: c.LINE }]}
            onPress={() => { onClose(); setTimeout(() => a.onPress(), 250); }} activeOpacity={0.75}>
            <Feather name={a.icon} size={18} color={a.danger ? "#e05a5a" : c.ACCENT} style={{ marginRight: 14 }} />
            <Text style={[msStyles.actionText, { color: a.danger ? "#e05a5a" : c.INK }]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>
    </Modal>
  );
}
const msStyles = StyleSheet.create({
  backdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet:       { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingHorizontal: 16 },
  handle:      { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  action:      { flexDirection: "row", alignItems: "center", paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  actionText:  { fontSize: 15.5, flex: 1 },
});

export default function ChatScreen({ route, navigation }) {
  const { conv } = route.params;
  const me = useAuthStore(s => s.user);
  const insets = useSafeAreaInsets();
  const c = useTheme();

  const [msgs,    setMsgs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [text,    setText]    = useState("");
  const [sending, setSending] = useState(false);
  const [typing,  setTyping]  = useState(false);
  const [online,  setOnline]  = useState(false);
  const [muted,   setMuted]   = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [editMsg, setEditMsg] = useState(null);
  const [forwardMsg, setForwardMsg] = useState(null);
  const [msgSheet, setMsgSheet] = useState(null); // { msg, isMe }
  const [forwardTarget, setForwardTarget] = useState(null); // message to forward
  const [uploadingImg, setUploadingImg] = useState(false);

  // Voice
  const [recording,   setRecording]   = useState(null);
  const [recDuration, setRecDuration] = useState(0);
  const recTimer = useRef(null);

  // Lightbox
  const [lightboxData, setLightboxData] = useState(null); // { images, index }

  const [kbVisible, setKbVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKbVisible(true));
    const hide  = Keyboard.addListener("keyboardDidHide", () => setKbVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const typingTimer    = useRef(null);
  const lastTypingSent = useRef(0);
  const listRef        = useRef(null);

  const load = useCallback(async () => {
    try {
      const list = await api(`/messages/${conv.id}`);
      setMsgs(Array.isArray(list) ? list.reverse() : []);
      await api(`/messages/${conv.id}/read`, { method: "POST" });
    } catch {}
    finally { setLoading(false); }
  }, [conv.id]);

  useEffect(() => {
    load();
    const offNew = wsOn("dm:new", (m) => {
      if (!m.msg || (m.msg.conv_id ?? m.conv?.id) !== conv.id) return;
      setMsgs(prev => [m.msg, ...prev]);
      api(`/messages/${conv.id}/read`, { method: "POST" }).catch(() => {});
    });
    const offEdit = wsOn("dm:edit", (m) => {
      if (!m.msgId) return;
      setMsgs(prev => prev.map(msg => msg.id === m.msgId ? { ...msg, body: m.body, edited_at: m.editedAt } : msg));
    });
    const offDelete = wsOn("dm:delete", (m) => {
      if (!m.msgId || m.convId !== conv.id) return;
      setMsgs(prev => prev.map(msg => msg.id === m.msgId ? { ...msg, deleted_for_all: 1, body: "" } : msg));
    });
    const offTyping = wsOn("dm:typing", (m) => {
      if (m.convId !== conv.id) return;
      setTyping(true);
      clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTyping(false), 3000);
    });
    const offRead = wsOn("dm:read", (m) => {
      if (m.convId !== conv.id) return;
      setMsgs(prev => prev.map(msg => (msg.is_mine || msg.sender_id === me?.id) && !msg.read_at ? { ...msg, read_at: m.readAt } : msg));
    });
    const offPresence = wsOn("presence", (m) => {
      if (conv.other_id && m.userId !== conv.other_id) return;
      setOnline(!m.hidden && m.online);
    });
    return () => { offNew(); offEdit(); offDelete(); offTyping(); offRead(); offPresence(); clearTimeout(typingTimer.current); };
  }, [conv.id, conv.other_id, me?.id]);

  const sendTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingSent.current < 2000) return;
    lastTypingSent.current = now;
    ws.send({ type: "dm:typing", convId: conv.id });
  }, [conv.id]);

  const send = async () => {
    if (editMsg) {
      // Edit mode
      const body = text.trim();
      if (!body) return;
      setText(""); setEditMsg(null);
      try {
        const updated = await api(`/messages/msg/${editMsg.id}`, { method: "PATCH", body: { body } });
        setMsgs(prev => prev.map(m => m.id === updated.id ? updated : m));
        haptic.success();
      } catch (e) { Alert.alert("Ошибка", e.message); }
      return;
    }

    const body = text.trim();
    if (!body || sending) return;
    const replyId = replyTo?.id;
    setText(""); setReplyTo(null);
    setSending(true);
    haptic.light();
    try {
      const payload = { body };
      if (replyId) payload.replyToId = replyId;
      const msg = await api(`/messages/${conv.id}/send`, { method: "POST", body: payload });
      setMsgs(prev => [msg, ...prev]);
    } catch {}
    finally { setSending(false); }
  };

  const pickAndSendImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Нет доступа", "Разреши доступ к медиатеке в настройках."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", selectionLimit: 4, quality: 0.85 });
    if (result.canceled || !result.assets?.length) return;
    setUploadingImg(true);
    haptic.light();
    try {
      const urls = await uploadAssets(result.assets);
      const msg = await api(`/messages/${conv.id}/send`, { method: "POST", body: { body: "", images: urls } });
      setMsgs(prev => [msg, ...prev]);
      haptic.success();
    } catch (e) { Alert.alert("Ошибка", e.message); }
    setUploadingImg(false);
  };

  const recRef = useRef(null);

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Нет доступа", "Разреши доступ к микрофону в настройках.");
        return;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const rec = new Audio.Recording();
      await rec.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await rec.startAsync();
      recRef.current = rec;
      setRecording(true);
      setRecDuration(0);
      recTimer.current = setInterval(() => setRecDuration(d => d + 1), 1000);
      haptic.light();
    } catch (e) {
      Alert.alert("Ошибка", "Не удалось начать запись: " + e.message);
    }
  };

  const stopRecording = async () => {
    if (!recRef.current) return;
    clearInterval(recTimer.current);
    setRecording(false);
    try {
      await recRef.current.stopAndUnloadAsync();
      const uri = recRef.current.getURI();
      recRef.current = null;
      if (!uri) return;
      setRecDuration(0);
      haptic.medium();
      const msg = await uploadVoiceAsset(uri, conv.id);
      if (msg?.id) {
        setMsgs(prev => [msg, ...prev]);
        haptic.success();
      }
    } catch (e) {
      Alert.alert("Ошибка", "Не удалось отправить голосовое: " + e.message);
      recRef.current = null;
    }
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
  };

  const cancelRecording = async () => {
    clearInterval(recTimer.current);
    setRecording(false);
    setRecDuration(0);
    try {
      await recRef.current?.stopAndUnloadAsync();
    } catch {}
    recRef.current = null;
    await Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
    haptic.light();
  };

  const handleDelete = (msg) => {
    Alert.alert("Удалить сообщение?", "Будет удалено для всех.", [
      { text: "Отмена", style: "cancel" },
      { text: "Удалить", style: "destructive", onPress: async () => {
        try {
          await api(`/messages/msg/${msg.id}`, { method: "DELETE" });
          setMsgs(prev => prev.map(m => m.id === msg.id ? { ...m, deleted_for_all: 1, body: "" } : m));
          haptic.success();
        } catch (e) { Alert.alert("Ошибка", e.message); }
      }},
    ]);
  };

  const handleForward = (msg) => {
    haptic.light();
    setForwardTarget(msg);
  };

  const toggleMute = async () => {
    haptic.light();
    try {
      if (muted) {
        await api(`/messages/${conv.id}/mute`, { method: "DELETE" });
        setMuted(false);
      } else {
        await api(`/messages/${conv.id}/mute`, { method: "POST" });
        setMuted(true);
        Alert.alert("Заглушено", "Уведомления от этого диалога отключены.");
      }
    } catch (e) { Alert.alert("Ошибка", e.message); }
  };

  // Build list with date separators (inverted FlatList)
  const listItems = useMemo(() => {
    const items = [];
    for (let i = 0; i < msgs.length; i++) {
      items.push(msgs[i]);
      const currDate = msgs[i].created_at ? fmtDate(msgs[i].created_at) : null;
      const nextDate = msgs[i + 1]?.created_at ? fmtDate(msgs[i + 1].created_at) : null;
      if (currDate && currDate !== nextDate) {
        items.push({ _sep: true, date: currDate, key: `sep-${currDate}-${i}` });
      }
    }
    return items;
  }, [msgs]);

  const title = conv.is_group ? (conv.title || "Группа") : (conv.other_name || conv.title || "Диалог");
  const fmtRecDur = `${Math.floor(recDuration / 60)}:${String(recDuration % 60).padStart(2, "0")}`;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: c.BG }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 10 : 0}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: c.SURFACE, borderBottomColor: c.LINE }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={c.ACCENT} />
        </TouchableOpacity>
        <View style={styles.avatarWrap}>
          <Avatar url={conv.other_avatar || conv.avatar_url} name={title} size={36} />
          {online && <View style={[styles.onlineDot, { borderColor: c.SURFACE }]} />}
        </View>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerName, { color: c.INK }]} numberOfLines={1}>{title}</Text>
          {typing
            ? <Text style={[styles.typingText, { color: c.ACCENT }]}>печатает...</Text>
            : online
              ? <Text style={styles.onlineText}>онлайн</Text>
              : conv.other_handle
                ? <Text style={[styles.headerSub, { color: c.INK_SOFT }]}>@{conv.other_handle}</Text>
                : null
          }
        </View>
        {/* Call button (DM only) */}
        {!conv.is_group && (
          <TouchableOpacity
            onPress={() => navigation.navigate("VoiceCall", { conv, isOutgoing: true })}
            style={styles.headerBtn}
            activeOpacity={0.7}
          >
            <Feather name="phone" size={18} color={c.ACCENT} />
          </TouchableOpacity>
        )}
        {/* Mute button */}
        <TouchableOpacity onPress={toggleMute} style={styles.headerBtn} activeOpacity={0.7}>
          <Feather name={muted ? "bell-off" : "bell"} size={18} color={muted ? c.INK_SOFT : c.ACCENT} />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={c.ACCENT} size="large" /></View>
      ) : (
        <FlatList
          ref={listRef}
          inverted
          data={listItems}
          keyExtractor={item => item._sep ? item.key : String(item.id)}
          renderItem={({ item, index }) => {
            if (item._sep) return <DateSep date={item.date} />;
            const isMe = item.is_mine || item.sender_id === me?.id;
            const next = listItems[index + 1];
            const showAvatar = !isMe && (!next || next._sep || next.sender_id !== item.sender_id);
            return (
              <MsgBubble
                msg={item}
                isMe={isMe}
                showAvatar={showAvatar}
                conv={conv}
                onReply={msg => { haptic.select(); setReplyTo({ id: msg.id, body: msg.body, sender_name: isMe ? (me?.name || "Вы") : (conv.other_name || "Собеседник") }); setEditMsg(null); }}
                onEdit={msg => { setEditMsg(msg); setText(msg.body || ""); setReplyTo(null); }}
                onDelete={handleDelete}
                onForward={handleForward}
                onLightbox={(imgs, idx) => setLightboxData({ images: imgs, index: idx })}
                onLongPress={(msg) => { haptic.medium(); setMsgSheet({ msg, isMe }); }}
              />
            );
          }}
          contentContainerStyle={styles.msgList}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          removeClippedSubviews
          maxToRenderPerBatch={12}
          windowSize={6}
          initialNumToRender={20}
        />
      )}

      {/* Reply / Edit bar */}
      <ReplyBar replyTo={replyTo} editMode={editMsg} onCancel={() => { setReplyTo(null); setEditMsg(null); setText(""); }} />

      {/* Voice recording overlay */}
      {recording && (
        <View style={[styles.recBar, { backgroundColor: c.SURFACE, borderTopColor: c.LINE }]}>
          <TouchableOpacity onPress={cancelRecording} style={styles.recCancel}>
            <Feather name="x" size={18} color="#e05a5a" />
          </TouchableOpacity>
          <View style={styles.recDot} />
          <Text style={[styles.recTime, { color: c.INK }]}>{fmtRecDur}</Text>
          <Text style={[styles.recHint, { color: c.INK_SOFT }]}>Отпусти чтобы отправить</Text>
          <TouchableOpacity onPress={stopRecording} style={[styles.recSend, { backgroundColor: `${c.ACCENT}18` }]}>
            <Feather name="send" size={18} color={c.ACCENT} />
          </TouchableOpacity>
        </View>
      )}

      {/* Input */}
      {!recording && (
        <View style={[styles.inputWrap, { backgroundColor: c.SURFACE, borderTopColor: c.LINE, paddingBottom: Platform.OS === "ios" ? insets.bottom + 6 : 8 }]}>
          {/* Attach image */}
          <TouchableOpacity onPress={pickAndSendImages} style={styles.attachBtn} activeOpacity={0.7} disabled={uploadingImg}>
            {uploadingImg
              ? <ActivityIndicator size="small" color={c.ACCENT} />
              : <Feather name="image" size={20} color={c.INK_SOFT} />
            }
          </TouchableOpacity>

          <TextInput
            style={[styles.input, { backgroundColor: c.WARM, color: c.INK }]}
            placeholder={editMsg ? "Редактировать..." : replyTo ? "Ответить..." : "Сообщение..."}
            placeholderTextColor={c.INK_SOFT}
            value={text}
            onChangeText={v => { setText(v); sendTyping(); }}
            multiline
            maxLength={4000}
          />

          {text.trim() || editMsg ? (
            <TouchableOpacity style={[styles.sendBtn, { backgroundColor: c.ACCENT }, sending && styles.sendBtnOff]} onPress={send} disabled={sending} activeOpacity={0.8}>
              {sending ? <ActivityIndicator color="#fff" size="small" /> : <Feather name={editMsg ? "check" : "send"} size={17} color="#fff" />}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={[styles.voiceBtn, { backgroundColor: `${c.ACCENT}18` }]} onPressIn={startRecording} onPressOut={stopRecording} activeOpacity={0.8} delayLongPress={9999}>
              <Feather name="mic" size={18} color={c.ACCENT} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Message action sheet */}
      <MsgActionSheet
        sheet={msgSheet}
        onClose={() => setMsgSheet(null)}
        onReply={(msg) => { setMsgSheet(null); setReplyTo({ id: msg.id, body: msg.body, sender_name: msgSheet?.isMe ? (me?.name || "Вы") : (conv.other_name || "Собеседник") }); setEditMsg(null); }}
        onEdit={(msg) => { setMsgSheet(null); setEditMsg(msg); setText(msg.body || ""); setReplyTo(null); }}
        onForward={handleForward}
        onDelete={handleDelete}
      />

      {/* Lightbox */}
      {lightboxData && (
        <Lightbox
          images={lightboxData.images}
          initialIndex={lightboxData.index}
          visible={true}
          onClose={() => setLightboxData(null)}
        />
      )}

      {/* Forward modal */}
      <ForwardModal
        visible={!!forwardTarget}
        message={forwardTarget}
        onClose={() => setForwardTarget(null)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1 },

  header:       { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn:      { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19 },
  avatarWrap:   { position: "relative" },
  onlineDot:    { position: "absolute", bottom: 0, right: 0, width: 10, height: 10, borderRadius: 5, backgroundColor: "#4caf50", borderWidth: 2 },
  headerInfo:   { flex: 1 },
  headerName:   { fontSize: 16, fontWeight: "700" },
  headerSub:    { fontSize: 12 },
  typingText:   { fontSize: 12, fontStyle: "italic" },
  onlineText:   { fontSize: 12, color: "#4caf50", fontWeight: "600" },
  headerBtn:    { width: 38, height: 38, alignItems: "center", justifyContent: "center" },

  center:       { flex: 1, alignItems: "center", justifyContent: "center" },

  msgList:      { paddingHorizontal: 10, paddingVertical: 6, gap: 2 },
  msgRow:       { flexDirection: "row", alignItems: "flex-end", gap: 6, marginVertical: 1 },
  msgRowMe:     { flexDirection: "row-reverse" },

  // Bubble: "my" messages have a tail at bottom-right, "their" at bottom-left
  bubble:       { maxWidth: "78%", borderRadius: 20, paddingHorizontal: 13, paddingVertical: 8, gap: 3 },
  bubbleMe:     { borderBottomRightRadius: 5 },
  bubbleThem:   { borderBottomLeftRadius: 5, elevation: 1, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 4 },
  bubbleCont:   { borderBottomLeftRadius: 20 },
  bubbleText:   { fontSize: 15.5, lineHeight: 22 },
  bubbleTextMe: { color: "#fff" },
  deletedText:  { fontStyle: "italic", opacity: 0.55 },
  bubbleMeta:   { flexDirection: "row", alignItems: "center", gap: 3, alignSelf: "flex-end", marginTop: 1 },
  bubbleTime:   { fontSize: 11 },
  bubbleTimeMe: { color: "rgba(255,255,255,0.72)" },
  editedText:   { fontSize: 10, fontStyle: "italic" },
  editedTextMe: { color: "rgba(255,255,255,0.6)" },
  readStatus:   { flexDirection: "row", alignItems: "center" },
  msgImg:       { width: 210, height: 170, borderRadius: 12, marginBottom: 4 },

  forwardedLabel:    { fontSize: 11, fontStyle: "italic", marginBottom: 2, opacity: 0.8 },
  forwardedLabelMe:  { color: "rgba(255,255,255,0.7)" },

  replyQuote:     { borderLeftWidth: 3, paddingLeft: 8, marginBottom: 5, borderRadius: 2, opacity: 0.85 },
  replyQuoteMe:   { borderLeftColor: "rgba(255,255,255,0.5)" },
  replyName:      { fontSize: 11.5, fontWeight: "700" },
  replyNameMe:    { color: "rgba(255,255,255,0.9)" },
  replyText:      { fontSize: 12 },
  replyTextMe:    { color: "rgba(255,255,255,0.7)" },

  // Voice player
  voiceRow:     { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 2, minWidth: 160 },
  voicePlayBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  voiceBar:     { flex: 1, height: 3, borderRadius: 2, overflow: "hidden" },
  voiceFill:    { height: "100%", borderRadius: 2 },
  voiceTime:    { fontSize: 11, minWidth: 34, textAlign: "right" },

  dateSep:      { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 10 },
  dateLine:     { flex: 1, height: StyleSheet.hairlineWidth },
  dateText:     { fontSize: 12, fontWeight: "600", paddingHorizontal: 4 },

  replyBar:      { borderTopWidth: StyleSheet.hairlineWidth },
  replyBarInner: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  replyBarAccent:{ width: 3, height: 32, borderRadius: 2 },
  replyBarName:  { fontSize: 12, fontWeight: "700" },
  replyBarText:  { fontSize: 12, marginTop: 1 },

  // Voice recording bar
  recBar:       { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  recCancel:    { width: 38, height: 38, borderRadius: 19, backgroundColor: "#fde8e8", alignItems: "center", justifyContent: "center" },
  recDot:       { width: 8, height: 8, borderRadius: 4, backgroundColor: "#e05a5a" },
  recTime:      { fontSize: 15, fontWeight: "700", minWidth: 48 },
  recHint:      { flex: 1, fontSize: 13 },
  recSend:      { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },

  inputWrap:    { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 6, borderTopWidth: StyleSheet.hairlineWidth },
  attachBtn:    { width: 36, height: 42, alignItems: "center", justifyContent: "center" },
  input:        { flex: 1, minHeight: 42, maxHeight: 130, borderRadius: 22, paddingHorizontal: 16, paddingTop: 11, paddingBottom: 11, fontSize: 15.5 },
  sendBtn:      { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", marginBottom: 0 },
  sendBtnOff:   { opacity: 0.4 },
  voiceBtn:     { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
});
