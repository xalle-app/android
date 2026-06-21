import { useState, useEffect, useCallback, useRef, memo, useMemo } from "react";
import {
  View, Text, FlatList, RefreshControl, StyleSheet,
  TouchableOpacity, Alert, Modal, Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";
import Feather from "@expo/vector-icons/Feather";
import Avatar from "../components/Avatar.jsx";
import { api } from "../lib/api.js";
import { haptic } from "../lib/haptics.js";
import { timeAgo } from "../lib/format.js";
import { wsOn } from "../lib/ws.js";
import { useUnreadStore } from "../store/unread.js";
import { useTheme } from "../store/theme.js";

// ─────────────────────────────────────────────────────────────────
// Type config (colors resolved dynamically in NotifItem via useTheme)
// ─────────────────────────────────────────────────────────────────
const TYPE_CFG = {
  like:            { icon: "heart",             color: "#e05a5a", label: "лайкнул(а) твой пост" },
  postReaction:    { icon: "heart",             color: "#e05a5a", label: "отреагировал(а) на пост" },
  comment:         { icon: "message-circle",    color: null,      label: "прокомментировал(а) твой пост" },
  reply:           { icon: "corner-down-right", color: null,      label: "ответил(а) на твой комментарий" },
  commentReaction: { icon: "smile",             color: "#e0b85a", label: "поставил(а) реакцию на комментарий" },
  follow:          { icon: "user-plus",         color: "#5ab0e0", label: "подписался(ась) на тебя" },
  mention:         { icon: "at-sign",           color: "#a05ae0", label: "упомянул(а) тебя в посте" },
  repost:          { icon: "repeat",            color: "#5a8be0", label: "поделился(ась) твоим постом" },
  gift:            { icon: "gift",              color: "#e07a5a", label: "отправил(а) тебе подарок 🎁" },
  system:          { icon: "info",              color: null,      label: "" },
};

// ─────────────────────────────────────────────────────────────────
// Action sheet (кастомный, вместо Alert)
// ─────────────────────────────────────────────────────────────────
function NotifActionSheet({ visible, onClose, onDelete, onMarkRead, isRead }) {
  const c = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 65, friction: 11 }).start();
    } else {
      Animated.timing(anim, { toValue: 0, duration: 180, useNativeDriver: true }).start();
    }
  }, [visible]);

  if (!visible) return null;

  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] });
  const opacity    = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[st.sheetBackdrop, { opacity }]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} activeOpacity={1} />
      </Animated.View>
      <Animated.View style={[st.sheet, { backgroundColor: c.SURFACE, transform: [{ translateY }] }]}>
        <View style={[st.sheetHandle, { backgroundColor: c.LINE }]} />

        {!isRead && (
          <TouchableOpacity
            style={st.sheetItem}
            activeOpacity={0.7}
            onPress={() => { onClose(); onMarkRead(); }}
          >
            <View style={[st.sheetIcon, { backgroundColor: `${c.ACCENT}12` }]}>
              <Feather name="check-circle" size={17} color={c.ACCENT} />
            </View>
            <Text style={[st.sheetItemText, { color: c.INK }]}>Отметить прочитанным</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[st.sheetItem]}
          activeOpacity={0.7}
          onPress={() => { onClose(); setTimeout(onDelete, 280); }}
        >
          <View style={[st.sheetIcon, st.sheetIconDanger]}>
            <Feather name="trash-2" size={17} color="#e05a5a" />
          </View>
          <Text style={[st.sheetItemText, st.sheetItemTextDanger]}>Удалить уведомление</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[st.sheetCancel, { backgroundColor: c.WARM }]} activeOpacity={0.7} onPress={onClose}>
          <Text style={[st.sheetCancelText, { color: c.INK_SOFT }]}>Отмена</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

// ─────────────────────────────────────────────────────────────────
// Swipe hint panels
// ─────────────────────────────────────────────────────────────────
function DeleteHint() {
  return (
    <View style={st.deleteHint}>
      <Feather name="trash-2" size={18} color="#fff" />
    </View>
  );
}

function ReadHint() {
  return (
    <View style={st.readHint}>
      <Feather name="check" size={18} color="#fff" />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// Single notification item
// ─────────────────────────────────────────────────────────────────
const NotifItem = memo(function NotifItem({ item, onPress, onDelete, onMarkRead }) {
  const c = useTheme();
  const cfgBase = TYPE_CFG[item.type] || { icon: "bell", color: null, label: item.type };
  const cfg = { ...cfgBase, color: cfgBase.color ?? c.ACCENT, ...(item.type === "system" && { color: c.INK_SOFT }) };
  const swipeRef     = useRef(null);
  const alertRef     = useRef(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const label = item.type === "system" ? (item.text || "") : cfg.label;

  // Trim context snippet (don't show same text as label)
  const snippet = (item.type !== "system" && item.text && item.text.length > 2) ? item.text : null;

  const handleSwipeOpen = (direction) => {
    if (direction === "right") {
      // right-side revealed = delete
      if (alertRef.current) return;
      alertRef.current = true;
      swipeRef.current?.close();
      haptic.medium();
      setSheetOpen(true);
      // reset guard after sheet closes
      setTimeout(() => { alertRef.current = false; }, 800);
    } else {
      // left-side revealed = mark read
      swipeRef.current?.close();
      if (!item.read) { haptic.light(); onMarkRead(item.id); }
    }
  };

  return (
    <>
      <Swipeable
        ref={swipeRef}
        renderRightActions={() => <DeleteHint />}
        renderLeftActions={() => !item.read ? <ReadHint /> : null}
        rightThreshold={60}
        leftThreshold={60}
        friction={2}
        overshootRight={false}
        overshootLeft={false}
        onSwipeableOpen={handleSwipeOpen}
      >
        <TouchableOpacity
          style={[st.item, { backgroundColor: item.read ? c.SURFACE : `${c.ACCENT}08` }]}
          onPress={() => onPress(item)}
          onLongPress={() => { haptic.medium(); setSheetOpen(true); }}
          delayLongPress={380}
          activeOpacity={0.82}
        >
          {/* Colored type icon */}
          <View style={[st.typeIcon, { backgroundColor: `${cfg.color}18`, borderColor: c.SURFACE }]}>
            <Feather name={cfg.icon} size={13} color={cfg.color} />
          </View>

          {/* Avatar */}
          <Avatar url={item.actor_avatar} name={item.actor_name} size={40} />

          {/* Text block */}
          <View style={st.textBlock}>
            <Text style={[st.mainLine, { color: c.INK }]} numberOfLines={2}>
              <Text style={st.actorName}>{item.actor_name}</Text>
              {label ? <Text style={{ color: c.INK_SOFT }}> {label}</Text> : null}
            </Text>
            {!!snippet && (
              <Text style={[st.snippet, { color: c.INK_SOFT }]} numberOfLines={2}>«{snippet}»</Text>
            )}
            <Text style={[st.time, { color: c.INK_SOFT }]}>{timeAgo(item.created_at)}</Text>
          </View>

          {/* Unread dot */}
          {!item.read && <View style={[st.dot, { backgroundColor: c.ACCENT }]} />}
        </TouchableOpacity>
      </Swipeable>

      <NotifActionSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onDelete={() => onDelete(item.id)}
        onMarkRead={() => onMarkRead(item.id)}
        isRead={item.read}
      />
    </>
  );
});

// ─────────────────────────────────────────────────────────────────
// Screen
// ─────────────────────────────────────────────────────────────────
export default function NotificationsScreen({ navigation }) {
  const insets         = useSafeAreaInsets();
  const c              = useTheme();
  const setNotifUnread = useUnreadStore(s => s.setNotifications);
  const [items, setItems]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api("/notifications");
      const list = Array.isArray(data) ? data : [];
      setItems(list);
      setNotifUnread(list.filter(n => !n.read).length);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, [setNotifUnread]);

  useEffect(() => {
    load();
    const off = wsOn("notif", () => load());
    return off;
  }, []);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handlePress = async (item) => {
    if (!item.read) {
      api(`/notifications/${item.id}/read`, { method: "POST" }).catch(() => {});
      setItems(prev => {
        const next = prev.map(n => n.id === item.id ? { ...n, read: true } : n);
        setNotifUnread(next.filter(n => !n.read).length);
        return next;
      });
    }
    if (item.type === "follow") {
      navigation.navigate("UserProfile", { handle: item.actor_handle });
    } else if (item.post_id) {
      try {
        const post = await api(`/v2/posts/${item.post_id}`);
        if (post?.id) navigation.navigate("PostDetail", { post });
      } catch (e) { console.error("[notif] load post:", e.message); }
    } else if (item.actor_handle) {
      navigation.navigate("UserProfile", { handle: item.actor_handle });
    }
  };

  const handleDelete = useCallback((id) => {
    setItems(prev => {
      const next = prev.filter(n => n.id !== id);
      setNotifUnread(next.filter(n => !n.read).length);
      return next;
    });
    api(`/v2/notifications/${id}`, { method: "DELETE" }).catch(() => {});
  }, [setNotifUnread]);

  const handleMarkRead = useCallback((id) => {
    setItems(prev => {
      const next = prev.map(n => n.id === id ? { ...n, read: true } : n);
      setNotifUnread(next.filter(n => !n.read).length);
      return next;
    });
    api(`/notifications/${id}/read`, { method: "POST" }).catch(() => {});
  }, [setNotifUnread]);

  const unreadCount = useMemo(() => items.filter(i => !i.read).length, [items]);

  return (
    <View style={[st.root, { backgroundColor: c.BG }]}>
      <View style={[st.header, { paddingTop: insets.top + 14, backgroundColor: c.SURFACE, borderBottomColor: c.LINE }]}>
        <Text style={[st.title, { color: c.INK }]}>Уведомления</Text>
        {unreadCount > 0 && (
          <TouchableOpacity
            onPress={() => {
              setItems(prev => prev.map(n => ({ ...n, read: true })));
              setNotifUnread(0);
              api("/notifications/read", { method: "POST" }).catch(() => {});
            }}
          >
            <Text style={[st.readAll, { color: c.ACCENT }]}>Прочитать все</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={items}
        keyExtractor={i => String(i.id)}
        renderItem={({ item }) => (
          <NotifItem
            item={item}
            onPress={handlePress}
            onDelete={handleDelete}
            onMarkRead={handleMarkRead}
          />
        )}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.ACCENT} />}
        contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
        removeClippedSubviews
        maxToRenderPerBatch={10}
        windowSize={5}
        ItemSeparatorComponent={() => <View style={[st.sep, { backgroundColor: c.LINE }]} />}
        ListEmptyComponent={
          !loading && (
            <View style={st.empty}>
              <Feather name="bell-off" size={36} color={c.INK_SOFT} style={{ opacity: 0.4, marginBottom: 12 }} />
              <Text style={[st.emptyText, { color: c.INK_SOFT }]}>Пока нет уведомлений</Text>
            </View>
          )
        }
      />
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  root:     { flex: 1 },
  header:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  title:    { fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  readAll:  { fontSize: 13.5, fontWeight: "600" },

  item:       { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  sep:        { height: StyleSheet.hairlineWidth, marginLeft: 76 },

  typeIcon:   { position: "absolute", left: 40, top: 9, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center", zIndex: 1, borderWidth: 2 },

  textBlock:  { flex: 1, gap: 3 },
  mainLine:   { fontSize: 14.5, lineHeight: 21 },
  actorName:  { fontWeight: "700" },
  snippet:    { fontSize: 13, fontStyle: "italic", lineHeight: 18 },
  time:       { fontSize: 12, marginTop: 1 },
  dot:        { width: 9, height: 9, borderRadius: 5 },

  deleteHint: { width: 82, backgroundColor: "#e05a5a", alignItems: "center", justifyContent: "center" },
  readHint:   { width: 82, backgroundColor: "#5b9e6e", alignItems: "center", justifyContent: "center" },

  empty:      { alignItems: "center", paddingTop: 80 },
  emptyText:  { fontSize: 15, fontWeight: "500", marginTop: 0 },

  sheetBackdrop:        { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  sheet:                { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 40, paddingTop: 8, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 28, shadowOffset: { width: 0, height: -4 }, elevation: 24 },
  sheetHandle:          { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 18 },
  sheetItem:            { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 20, paddingVertical: 15 },
  sheetIcon:            { width: 40, height: 40, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  sheetIconDanger:      { backgroundColor: "#e05a5a14" },
  sheetItemText:        { flex: 1, fontSize: 15.5, fontWeight: "600" },
  sheetItemTextDanger:  { color: "#e05a5a" },
  sheetCancel:          { marginHorizontal: 16, marginTop: 6, paddingVertical: 15, borderRadius: 18, alignItems: "center" },
  sheetCancelText:      { fontSize: 15, fontWeight: "700" },
});
