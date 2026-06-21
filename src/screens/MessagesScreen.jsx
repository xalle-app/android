import { useState, useEffect, useCallback, useRef, memo } from "react";
import {
  View, Text, FlatList, RefreshControl, StyleSheet,
  TouchableOpacity, Modal, TextInput, KeyboardAvoidingView, Platform, Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { Swipeable } from "react-native-gesture-handler";
import Feather from "@expo/vector-icons/Feather";
import Avatar from "../components/Avatar.jsx";
import UserName from "../components/UserName.jsx";
import { api } from "../lib/api.js";
import { haptic } from "../lib/haptics.js";
import { timeAgo } from "../lib/format.js";
import { wsOn } from "../lib/ws.js";
import { useAuthStore } from "../store/auth.js";
import { useUnreadStore } from "../store/unread.js";
import { useTheme } from "../store/theme.js";

// ─── DM list ────────────────────────────────────────────────────────────────

function DeleteHint() {
  return (
    <View style={st.deleteAction}>
      <Feather name="trash-2" size={20} color="#fff" />
    </View>
  );
}

const ConvItem = memo(function ConvItem({ conv, onPress, onDeleteRequest }) {
  const c = useTheme();
  const swipeRef = useRef(null);
  const hasUnread = (conv.unread || 0) > 0;
  const swipingRef = useRef(false);

  const handleSwipeOpen = (direction) => {
    if (direction !== "right") return;
    if (swipingRef.current) return;
    swipingRef.current = true;
    haptic.medium();
    swipeRef.current?.close();
    onDeleteRequest(conv, () => { swipingRef.current = false; });
  };

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={() => <DeleteHint />}
      rightThreshold={60}
      friction={2}
      overshootRight={false}
      onSwipeableOpen={handleSwipeOpen}
    >
      <TouchableOpacity style={[st.item, { backgroundColor: c.SURFACE, borderBottomColor: c.LINE }]} onPress={onPress} activeOpacity={0.8}>
        <Avatar url={conv.other_avatar || conv.avatar_url} name={conv.other_name || conv.title} size={46} />
        <View style={st.itemBody}>
          <View style={st.itemTop}>
            <View style={st.itemNameWrap}>
              <UserName
                name={conv.other_name || conv.title || "Диалог"}
                verified={conv.other_verified}
                role={conv.other_role}
                nameColor={conv.other_name_color}
                nameGradient={conv.other_name_gradient}
                subTier={conv.other_tier ?? 0}
                style={[st.itemName, { color: c.INK }, hasUnread && { fontWeight: "700" }]}
                numberOfLines={1}
              />
            </View>
            <Text style={[st.itemTime, { color: c.INK_SOFT }]}>{timeAgo(conv.last_at || conv.updated_at)}</Text>
          </View>
          <View style={st.itemBottom}>
            <Text style={[st.itemPreview, { color: c.INK_SOFT }, hasUnread && { fontWeight: "700", color: c.INK }]} numberOfLines={1}>
              {conv.last_msg || "Нет сообщений"}
            </Text>
            {hasUnread && (
              <View style={[st.badge, { backgroundColor: c.ACCENT }]}>
                <Text style={st.badgeText}>{conv.unread > 99 ? "99+" : conv.unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
});

// ─── Group list ─────────────────────────────────────────────────────────────

const GroupItem = memo(function GroupItem({ group, onPress, onLeave }) {
  const c = useTheme();
  const swipeRef = useRef(null);
  const alertShownRef = useRef(false);
  const hasUnread = (group.unread || 0) > 0;

  const handleSwipeOpen = (direction) => {
    if (direction !== "right") return;
    if (alertShownRef.current) return;
    alertShownRef.current = true;
    haptic.medium();
    swipeRef.current?.close();
    onLeave(group, () => { alertShownRef.current = false; });
  };

  return (
    <Swipeable
      ref={swipeRef}
      renderRightActions={() => <DeleteHint />}
      rightThreshold={60}
      friction={2}
      overshootRight={false}
      onSwipeableOpen={handleSwipeOpen}
    >
      <TouchableOpacity style={[st.item, { backgroundColor: c.SURFACE, borderBottomColor: c.LINE }]} onPress={onPress} activeOpacity={0.8}>
        <Avatar url={group.avatar_url} name={group.name} size={46} />
        <View style={st.itemBody}>
          <View style={st.itemTop}>
            <View style={st.itemNameWrap}>
              <Text style={[st.itemName, { color: c.INK }, hasUnread && { fontWeight: "700" }]} numberOfLines={1}>{group.name}</Text>
            </View>
            <Text style={[st.itemTime, { color: c.INK_SOFT }]}>{group.last_at ? timeAgo(group.last_at) : ""}</Text>
          </View>
          <View style={st.itemBottom}>
            <Text style={[st.itemPreview, { color: c.INK_SOFT }, hasUnread && { fontWeight: "700", color: c.INK }]} numberOfLines={1}>
              {group.last_msg || `${group.member_count ?? 0} участников`}
            </Text>
            {hasUnread && (
              <View style={[st.badge, { backgroundColor: c.ACCENT }]}>
                <Text style={st.badgeText}>{group.unread > 99 ? "99+" : group.unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
});

// ─── Confirm sheet ───────────────────────────────────────────────────────────

function ConfirmSheet({ visible, title, body, confirmLabel, danger, onConfirm, onClose }) {
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      tension: 70, friction: 12,
    }).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={st.sheetBackdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View
        style={[
          st.confirmSheet,
          { backgroundColor: c.SURFACE, paddingBottom: insets.bottom + 16 },
          { transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [300, 0] }) }] },
        ]}
      >
        <View style={[st.dragHandle, { backgroundColor: c.LINE }]} />
        <Text style={[st.confirmTitle, { color: c.INK }]}>{title}</Text>
        {!!body && <Text style={[st.confirmBody, { color: c.INK_SOFT }]}>{body}</Text>}
        <View style={st.confirmBtns}>
          <TouchableOpacity style={[st.confirmCancelBtn, { backgroundColor: c.WARM }]} onPress={onClose} activeOpacity={0.8}>
            <Text style={[st.confirmCancelText, { color: c.INK_SOFT }]}>Отмена</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.confirmOkBtn, { backgroundColor: danger ? "#e05a5a" : c.ACCENT }]}
            onPress={() => { onClose(); setTimeout(onConfirm, 200); }}
            activeOpacity={0.8}
          >
            <Text style={st.confirmOkText}>{confirmLabel || "Подтвердить"}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

// ─── Create group modal ──────────────────────────────────────────────────────

function CreateGroupModal({ visible, onClose, onCreate }) {
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const n = name.trim();
    if (!n) return;
    setBusy(true);
    try {
      const g = await api("/groups", { method: "POST", body: { name: n, type: "open" } });
      setName("");
      onClose();
      onCreate(g);
    } catch (e) {
      Alert.alert("Ошибка", e.message);
    } finally { setBusy(false); }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <TouchableOpacity style={st.modalBackdrop} activeOpacity={1} onPress={onClose} />
        <View style={[st.modalSheet, { backgroundColor: c.SURFACE, paddingBottom: insets.bottom + 20 }]}>
          <Text style={[st.modalTitle, { color: c.INK }]}>Новая группа</Text>
          <TextInput
            style={[st.modalInput, { backgroundColor: c.BG, borderColor: c.LINE, color: c.INK }]}
            placeholder="Название группы..."
            placeholderTextColor={c.INK_SOFT}
            value={name}
            onChangeText={setName}
            autoFocus
            maxLength={64}
          />
          <TouchableOpacity
            style={[st.modalBtn, { backgroundColor: c.ACCENT }, !name.trim() && { opacity: 0.4 }]}
            onPress={submit}
            disabled={busy || !name.trim()}
            activeOpacity={0.85}
          >
            <Text style={st.modalBtnText}>{busy ? "Создаём..." : "Создать"}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function MessagesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const me = useAuthStore(s => s.user);
  const setMsgUnread = useUnreadStore(s => s.setMessages);

  const [tab, setTab] = useState("dm");
  const [convs, setConvs]           = useState([]);
  const [groups, setGroups]         = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [createVisible, setCreateVisible] = useState(false);
  const [leaveConfirm, setLeaveConfirm]   = useState(false);
  const [leaveTarget, setLeaveTarget]     = useState(null);
  const [dmDeleteConfirm, setDmDeleteConfirm] = useState(false);
  const [dmDeleteTarget, setDmDeleteTarget]   = useState(null);
  const dmDeleteResetRef = useRef(null);

  // ── DM load ──
  const loadDm = useCallback(async () => {
    try {
      const data = await api("/messages");
      const list = Array.isArray(data) ? data : [];
      setConvs(list);
      setMsgUnread(list.filter(c => (c.unread || 0) > 0).length);
    } catch {}
  }, [setMsgUnread]);

  // ── Groups load ──
  const loadGroups = useCallback(async () => {
    try {
      const data = await api("/groups");
      setGroups(Array.isArray(data) ? data : []);
    } catch {}
  }, []);

  const load = useCallback(async () => {
    await Promise.all([loadDm(), loadGroups()]);
    setLoading(false);
    setRefreshing(false);
  }, [loadDm, loadGroups]);

  useEffect(() => { load(); }, []);
  useFocusEffect(useCallback(() => { load(); }, []));

  // ── WS listeners ──
  useEffect(() => {
    const offNew = wsOn("dm:new", (m) => {
      if (!m.msg) return;
      const isMine = me && (m.msg.sender_id === me.id || m.msg.is_mine);
      setConvs(prev => {
        const next = prev.map(conv =>
          conv.id === (m.msg.conv_id ?? m.conv?.id)
            ? { ...conv, last_msg: m.msg.body || "", last_at: m.msg.created_at, unread: isMine ? (conv.unread || 0) : (conv.unread || 0) + 1 }
            : conv
        );
        // defer cross-store update to avoid setState-in-render warning
        setTimeout(() => setMsgUnread(next.filter(conv => (conv.unread || 0) > 0).length), 0);
        return next;
      });
    });
    const offRead = wsOn("dm:read", (m) => {
      if (!m.convId) return;
      setConvs(prev => {
        const next = prev.map(conv => conv.id === m.convId ? { ...conv, unread: 0 } : conv);
        setTimeout(() => setMsgUnread(next.filter(conv => (conv.unread || 0) > 0).length), 0);
        return next;
      });
    });
    const offDel = wsOn("dm:conv_deleted", (m) => {
      if (!m.convId) return;
      setConvs(prev => prev.filter(c => c.id !== m.convId));
    });
    const offGrp = wsOn("group:new_message", (m) => {
      if (!m.msg?.group_id) return;
      setGroups(prev => prev.map(g =>
        g.id === m.msg.group_id
          ? { ...g, last_msg: m.msg.body || "", last_at: m.msg.created_at, unread: (g.unread || 0) + 1 }
          : g
      ));
    });
    return () => { offNew(); offRead(); offDel(); offGrp(); };
  }, []);

  const handleDeleteConv = useCallback(async (convId) => {
    haptic.medium();
    setConvs(prev => prev.filter(c => c.id !== convId));
    try {
      await api(`/messages/${convId}`, { method: "DELETE" });
    } catch { load(); }
  }, [load]);

  const handleDmDeleteRequest = useCallback((conv, reset) => {
    dmDeleteResetRef.current = reset;
    setDmDeleteTarget(conv);
    setDmDeleteConfirm(true);
  }, []);

  const handleLeaveGroup = useCallback(async () => {
    if (!leaveTarget) return;
    const id = leaveTarget.id;
    setGroups(prev => prev.filter(g => g.id !== id));
    try {
      await api(`/groups/${id}/leave`, { method: "POST" });
      haptic.success();
    } catch { load(); }
  }, [leaveTarget, load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const Segment = ({ label, id }) => (
    <TouchableOpacity
      style={[st.seg, tab === id && { borderBottomColor: c.ACCENT }]}
      onPress={() => setTab(id)}
      activeOpacity={0.8}
    >
      <Text style={[st.segText, { color: tab === id ? c.ACCENT : c.INK_SOFT }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[st.root, { backgroundColor: c.BG }]}>
      <View style={[st.header, { paddingTop: insets.top + 14, backgroundColor: c.SURFACE, borderBottomColor: c.LINE }]}>
        <Text style={[st.title, { color: c.INK }]}>Сообщения</Text>
        <TouchableOpacity style={[st.newBtn, { backgroundColor: `${c.ACCENT}15` }]} onPress={() => setCreateVisible(true)} activeOpacity={0.8}>
          <Feather name="edit" size={17} color={c.ACCENT} />
        </TouchableOpacity>
      </View>

      <View style={[st.segRow, { backgroundColor: c.SURFACE, borderBottomColor: c.LINE }]}>
        <Segment label="Личные" id="dm" />
        <Segment label="Группы" id="groups" />
      </View>

      {tab === "dm" ? (
        <FlatList
          data={convs}
          keyExtractor={item => String(item.id)}
          renderItem={({ item }) => (
            <ConvItem
              conv={item}
              onPress={() => navigation.navigate("ChatDetail", { conv: item })}
              onDeleteRequest={handleDmDeleteRequest}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.ACCENT} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          removeClippedSubviews
          maxToRenderPerBatch={10}
          windowSize={5}
          ListEmptyComponent={
            !loading && (
              <View style={st.empty}>
                <Feather name="message-circle" size={32} color={c.INK_SOFT} style={{ opacity: 0.4, marginBottom: 8 }} />
                <Text style={[st.emptyText, { color: c.INK_SOFT }]}>Нет диалогов</Text>
              </View>
            )
          }
        />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={g => String(g.id)}
          renderItem={({ item }) => (
            <GroupItem
              group={item}
              onPress={() => navigation.navigate("GroupChat", { group: item })}
              onLeave={(g, reset) => { setLeaveTarget(g); setLeaveConfirm(true); reset(); }}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.ACCENT} />}
          contentContainerStyle={{ paddingBottom: insets.bottom + 16 }}
          ListEmptyComponent={
            !loading && (
              <View style={st.empty}>
                <Feather name="users" size={32} color={c.INK_SOFT} style={{ opacity: 0.4, marginBottom: 8 }} />
                <Text style={[st.emptyText, { color: c.INK_SOFT }]}>Нет групп</Text>
                <TouchableOpacity style={[st.emptyBtn, { backgroundColor: c.ACCENT }]} onPress={() => setCreateVisible(true)} activeOpacity={0.8}>
                  <Text style={st.emptyBtnText}>Создать группу</Text>
                </TouchableOpacity>
              </View>
            )
          }
        />
      )}

      <CreateGroupModal
        visible={createVisible}
        onClose={() => setCreateVisible(false)}
        onCreate={(g) => { setGroups(prev => [{ ...g, member_count: g.members?.length ?? 1 }, ...prev]); setTab("groups"); }}
      />

      <ConfirmSheet
        visible={leaveConfirm}
        title="Покинуть группу?"
        body={leaveTarget ? `Ты больше не будешь видеть сообщения в «${leaveTarget.name}».` : ""}
        confirmLabel="Покинуть"
        danger
        onConfirm={handleLeaveGroup}
        onClose={() => setLeaveConfirm(false)}
      />

      <ConfirmSheet
        visible={dmDeleteConfirm}
        title="Удалить диалог?"
        body="Диалог удалится только у тебя. Собеседник его не потеряет."
        confirmLabel="Удалить"
        danger
        onConfirm={() => {
          if (dmDeleteTarget) handleDeleteConv(dmDeleteTarget.id);
          dmDeleteResetRef.current = null;
        }}
        onClose={() => {
          setDmDeleteConfirm(false);
          setDmDeleteTarget(null);
          dmDeleteResetRef.current?.();
          dmDeleteResetRef.current = null;
        }}
      />
    </View>
  );
}

const st = StyleSheet.create({
  root:             { flex: 1 },
  header:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  title:            { fontSize: 20, fontWeight: "800", letterSpacing: -0.3 },
  newBtn:           { width: 38, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 19 },

  segRow:           { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  seg:              { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  segText:          { fontSize: 14, fontWeight: "600" },

  item:             { flexDirection: "row", alignItems: "center", gap: 13, paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth },
  itemBody:         { flex: 1, minWidth: 0 },
  itemTop:          { flexDirection: "row", justifyContent: "space-between", marginBottom: 3 },
  itemNameWrap:     { flex: 1, marginRight: 8 },
  itemName:         { fontSize: 15.5 },
  itemTime:         { fontSize: 12, flexShrink: 0 },
  itemBottom:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  itemPreview:      { fontSize: 13.5, flex: 1 },
  badge:            { borderRadius: 11, minWidth: 22, height: 22, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, marginLeft: 6 },
  badgeText:        { color: "#fff", fontSize: 11, fontWeight: "800" },
  empty:            { alignItems: "center", paddingTop: 80 },
  emptyText:        { fontSize: 15, marginTop: 10 },
  emptyBtn:         { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 22 },
  emptyBtnText:     { color: "#fff", fontWeight: "700", fontSize: 14 },

  deleteAction:     { width: 90, backgroundColor: "#e05a5a", alignItems: "center", justifyContent: "center", borderRadius: 0 },

  sheetBackdrop:    { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.5)" },
  confirmSheet:     { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8, paddingHorizontal: 20 },
  dragHandle:       { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 18 },
  confirmTitle:     { fontSize: 18, fontWeight: "800", textAlign: "center", marginTop: 4, marginBottom: 8 },
  confirmBody:      { fontSize: 14, textAlign: "center", lineHeight: 21, marginBottom: 22 },
  confirmBtns:      { flexDirection: "row", gap: 10, marginTop: 4 },
  confirmCancelBtn: { flex: 1, paddingVertical: 15, borderRadius: 18, alignItems: "center" },
  confirmCancelText:{ fontWeight: "600", fontSize: 15 },
  confirmOkBtn:     { flex: 1, paddingVertical: 15, borderRadius: 18, alignItems: "center" },
  confirmOkText:    { fontWeight: "700", color: "#fff", fontSize: 15 },

  modalBackdrop:    { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  modalSheet:       { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, gap: 14 },
  modalTitle:       { fontSize: 19, fontWeight: "800", textAlign: "center" },
  modalInput:       { borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  modalBtn:         { borderRadius: 16, paddingVertical: 15, alignItems: "center" },
  modalBtnText:     { color: "#fff", fontWeight: "700", fontSize: 15 },
});
