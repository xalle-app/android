import { useEffect, useRef, useState, useCallback } from "react";
import {
  View, Text, TouchableOpacity, StyleSheet, Animated,
  TextInput, ActivityIndicator, Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import Avatar from "./Avatar.jsx";
import { wsOn } from "../lib/ws.js";
import { api } from "../lib/api.js";
import { useAuthStore } from "../store/auth.js";
import { useTheme } from "../store/theme.js";

const BANNER_MS = 5000;

let _uid = 0;
const uid = () => String(++_uid);

export default function DmBanner() {
  const insets     = useSafeAreaInsets();
  const navigation = useNavigation();
  const me         = useAuthStore(st => st.user);
  const c          = useTheme();
  const s          = useStyles(c);

  // queue: [{ id, msg, conv }, ...] — newest first
  const [queue, setQueue]         = useState([]);
  const [replying, setReplying]   = useState(false);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending]     = useState(false);

  const slideY  = useRef(new Animated.Value(-160)).current;
  const replyH  = useRef(new Animated.Value(0)).current;
  const timer   = useRef(null);
  const queueRef = useRef([]);
  queueRef.current = queue;

  // ── animation helpers ─────────────────────────────────────────────────

  const slideIn = useCallback(() => {
    Animated.spring(slideY, {
      toValue: 0, useNativeDriver: true, tension: 85, friction: 11,
    }).start();
  }, [slideY]);

  const slideOut = useCallback((cb) => {
    clearTimeout(timer.current);
    Animated.timing(slideY, {
      toValue: -160, duration: 200, useNativeDriver: true,
    }).start(() => cb?.());
  }, [slideY]);

  const openReply = useCallback(() => {
    clearTimeout(timer.current); // pause auto-dismiss while typing
    setReplying(true);
    Animated.spring(replyH, {
      toValue: 48, useNativeDriver: false, tension: 90, friction: 12,
    }).start();
  }, [replyH]);

  const closeReply = useCallback(() => {
    setReplying(false);
    setReplyText("");
    Keyboard.dismiss();
    Animated.timing(replyH, { toValue: 0, duration: 180, useNativeDriver: false }).start();
  }, [replyH]);

  // ── queue helpers ─────────────────────────────────────────────────────

  const startTimer = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      dismissCurrent();
    }, BANNER_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissCurrent = useCallback(() => {
    closeReply();
    slideOut(() => {
      setQueue(prev => {
        const rest = prev.slice(1);
        if (rest.length > 0) setTimeout(() => { slideIn(); startTimer(); }, 80);
        return rest;
      });
    });
  }, [closeReply, slideOut, slideIn, startTimer]);

  const addToQueue = useCallback((msg, conv) => {
    setQueue(prev => {
      const idx = prev.findIndex(e => e.conv?.id === conv?.id);
      if (idx !== -1) {
        // update existing entry
        const next = [...prev];
        next[idx] = { ...next[idx], msg, conv };
        if (idx === 0) { clearTimeout(timer.current); startTimer(); }
        return next;
      }
      const entry = { id: uid(), msg, conv };
      if (prev.length === 0) {
        setTimeout(() => { slideIn(); startTimer(); }, 30);
      }
      return [entry, ...prev];
    });
  }, [slideIn, startTimer]);

  // ── WS ────────────────────────────────────────────────────────────────

  useEffect(() => {
    const off = wsOn("dm:new", (m) => {
      if (!m.msg) return;
      if (m.msg.sender_id === me?.id || m.msg.is_mine) return;
      addToQueue(m.msg, m.conv);
    });
    return () => { off(); clearTimeout(timer.current); };
  }, [me?.id, addToQueue]);

  // ── send reply ────────────────────────────────────────────────────────

  const sendReply = useCallback(async () => {
    const text = replyText.trim();
    const cur = queueRef.current[0];
    if (!text || !cur?.conv?.id || sending) return;
    setSending(true);
    try {
      await api(`/messages/${cur.conv.id}/send`, { method: "POST", body: { body: text } });
      // Mark read so MessagesScreen doesn't show it as unread
      api(`/messages/${cur.conv.id}/read`, { method: "POST" }).catch(() => {});
      closeReply();
      setTimeout(() => dismissCurrent(), 300);
    } catch (e) {
      console.error("[DmBanner] send:", e.message);
    } finally {
      setSending(false);
    }
  }, [replyText, sending, closeReply, dismissCurrent]);

  // ── render ────────────────────────────────────────────────────────────

  if (queue.length === 0) return null;

  const { msg, conv } = queue[0];
  const name   = conv?.other_name   || msg?.sender_name   || "Сообщение";
  const avatar = conv?.other_avatar || msg?.sender_avatar || null;
  const body   = msg?.body
    ? (msg.body.length > 72 ? msg.body.slice(0, 72) + "…" : msg.body)
    : "Новое сообщение";
  const extra  = queue.length - 1;

  return (
    <Animated.View style={[s.container, { top: insets.top + 8, transform: [{ translateY: slideY }] }]}>
      <View style={s.card}>

        {/* top row: tap to open chat */}
        <TouchableOpacity
          style={s.topRow}
          activeOpacity={0.85}
          onPress={() => { dismissCurrent(); if (conv) navigation.navigate("ChatDetail", { conv }); }}
        >
          <Avatar url={avatar} name={name} size={38} />
          <View style={s.textCol}>
            <Text style={s.nameText} numberOfLines={1}>{name}</Text>
            <Text style={s.bodyText} numberOfLines={2}>{body}</Text>
          </View>
          <TouchableOpacity
            onPress={dismissCurrent}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={s.closeX}>✕</Text>
          </TouchableOpacity>
        </TouchableOpacity>

        {/* action bar */}
        <View style={s.actionRow}>
          <TouchableOpacity style={s.replyBtn} onPress={replying ? closeReply : openReply}>
            <Text style={s.replyBtnText}>{replying ? "Отмена" : "Ответить"}</Text>
          </TouchableOpacity>

          {extra > 0 && (
            <TouchableOpacity
              style={s.extraPill}
              onPress={() => { dismissCurrent(); navigation.navigate("Messages"); }}
            >
              <Text style={s.extraText}>+{extra} ещё</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* collapsible reply input */}
        <Animated.View style={[s.replyBox, { height: replyH }]}>
          <TextInput
            style={s.replyInput}
            placeholder="Написать ответ…"
            placeholderTextColor={c.INK_SOFT}
            value={replyText}
            onChangeText={setReplyText}
            returnKeyType="send"
            onSubmitEditing={sendReply}
            editable={!sending}
            autoFocus={replying}
          />
          <TouchableOpacity
            style={[s.sendBtn, (!replyText.trim() || sending) && s.sendBtnOff]}
            onPress={sendReply}
            disabled={!replyText.trim() || sending}
          >
            {sending
              ? <ActivityIndicator size="small" color="#fff" />
              : <Text style={s.sendIcon}>↑</Text>
            }
          </TouchableOpacity>
        </Animated.View>

      </View>
    </Animated.View>
  );
}

const s_layout = StyleSheet.create({
  container:  { position: "absolute", left: 12, right: 12, zIndex: 999 },
  topRow:     { flexDirection: "row", alignItems: "flex-start", gap: 10, padding: 12 },
  textCol:    { flex: 1 },
  actionRow:  { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingBottom: 10 },
  replyBtn:   { paddingHorizontal: 14, paddingVertical: 5, borderRadius: 20 },
  replyBtnText: { fontSize: 13, fontWeight: "600" },
  extraPill:  { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  extraText:  { fontSize: 13, fontWeight: "600" },
  replyBox:   { flexDirection: "row", alignItems: "center", overflow: "hidden", paddingHorizontal: 10, gap: 8 },
  replyInput: { flex: 1, height: 36, fontSize: 14, paddingHorizontal: 2 },
  sendBtn:    { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  sendBtnOff: { opacity: 0.4 },
  sendIcon:   { color: "#fff", fontSize: 17, fontWeight: "700" },
});

// Inline theme-dependent styles computed inside component via useTheme()
// accessed as `s.*` which merges layout + theme
function useStyles(c) {
  return {
    ...s_layout,
    container:  s_layout.container,
    card:       { backgroundColor: c.SURFACE, borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 9, borderWidth: 1, borderColor: c.LINE },
    topRow:     s_layout.topRow,
    textCol:    s_layout.textCol,
    nameText:   { fontSize: 14, fontWeight: "700", color: c.INK },
    bodyText:   { fontSize: 13, color: c.INK_SOFT, marginTop: 2, lineHeight: 18 },
    closeX:     { fontSize: 13, color: c.INK_SOFT, paddingTop: 2 },
    actionRow:  s_layout.actionRow,
    replyBtn:   [s_layout.replyBtn, { backgroundColor: `${c.ACCENT}18` }],
    replyBtnText: [s_layout.replyBtnText, { color: c.ACCENT }],
    extraPill:  [s_layout.extraPill, { backgroundColor: `${c.INK_SOFT}14` }],
    extraText:  [s_layout.extraText, { color: c.INK_SOFT }],
    replyBox:   [s_layout.replyBox, { backgroundColor: c.BG }],
    replyInput: [s_layout.replyInput, { color: c.INK }],
    sendBtn:    [s_layout.sendBtn, { backgroundColor: c.ACCENT }],
    sendBtnOff: s_layout.sendBtnOff,
    sendIcon:   s_layout.sendIcon,
  };
}

