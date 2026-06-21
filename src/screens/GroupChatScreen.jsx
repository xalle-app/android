import { useState, useEffect, useRef, useCallback, useMemo, memo } from "react";
import {
  View, Text, FlatList, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image, Alert, Keyboard,
  Modal, Animated, ScrollView,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import Avatar from "../components/Avatar.jsx";
import Lightbox from "../components/Lightbox.jsx";
import ForwardModal from "../components/ForwardModal.jsx";
import { api, assetUrl } from "../lib/api.js";
import { uploadAssets } from "../lib/upload.js";
import { haptic } from "../lib/haptics.js";
import { useAuthStore } from "../store/auth.js";
import { wsOn } from "../lib/ws.js";
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
    <View style={st.dateSep}>
      <View style={[st.dateLine, { backgroundColor: c.LINE }]} />
      <Text style={[st.dateText, { color: c.INK_SOFT }]}>{date}</Text>
      <View style={[st.dateLine, { backgroundColor: c.LINE }]} />
    </View>
  );
}

function ActionSheet({ visible, title, subtitle, actions, onClose }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
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
          st.sheet, { backgroundColor: c.SURFACE, paddingBottom: insets.bottom + 16 },
          { transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [400, 0] }) }] },
        ]}
      >
        {(title || subtitle) && (
          <View style={[st.sheetHeader, { borderBottomColor: c.LINE }]}>
            {title && <Text style={[st.sheetTitle, { color: c.INK }]}>{title}</Text>}
            {subtitle && <Text style={[st.sheetSubtitle, { color: c.INK_SOFT }]}>{subtitle}</Text>}
          </View>
        )}
        {actions.map((a, i) => (
          <TouchableOpacity
            key={i}
            style={[st.sheetAction, { borderBottomColor: c.LINE }]}
            onPress={() => { onClose(); setTimeout(() => a.onPress(), 200); }}
            activeOpacity={0.75}
          >
            {a.icon && <Feather name={a.icon} size={18} color={a.danger ? "#e05a5a" : c.INK} style={{ marginRight: 12 }} />}
            <Text style={[st.sheetActionText, { color: a.danger ? "#e05a5a" : c.INK }]}>{a.label}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>
    </Modal>
  );
}

function GroupInfoSheet({ visible, group, members, me, onClose, onLeave }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, {
      toValue: visible ? 1 : 0,
      useNativeDriver: true,
      tension: 70, friction: 12,
    }).start();
  }, [visible]);

  if (!visible) return null;

  const typeLabel = { open: "Открытая", request: "По запросу", closed: "Закрытая" }[group.type] || "Группа";
  const isCreator = group.creator_id === me?.id;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={st.sheetBackdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View
        style={[
          st.infoSheet, { backgroundColor: c.SURFACE, paddingBottom: insets.bottom + 20 },
          { transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [600, 0] }) }] },
        ]}
      >
        <View style={[st.dragHandle, { backgroundColor: c.LINE }]} />

        <View style={st.infoHead}>
          <Avatar url={group.avatar_url} name={group.name} size={64} />
          <Text style={[st.infoName, { color: c.INK }]}>{group.name}</Text>
          <View style={[st.typeBadge, { backgroundColor: `${c.ACCENT}15` }]}>
            <Feather name={group.type === "open" ? "globe" : "lock"} size={11} color={c.ACCENT} />
            <Text style={[st.typeBadgeText, { color: c.ACCENT }]}>{typeLabel}</Text>
          </View>
          {group.handle && <Text style={[st.infoHandle, { color: c.INK_SOFT }]}>@{group.handle}</Text>}
        </View>

        <View style={[st.infoStats, { borderColor: c.LINE }]}>
          <View style={st.infoStat}>
            <Text style={[st.infoStatNum, { color: c.INK }]}>{members.length}</Text>
            <Text style={[st.infoStatLabel, { color: c.INK_SOFT }]}>участников</Text>
          </View>
        </View>

        {members.length > 0 && (
          <View style={st.membersSection}>
            <Text style={[st.membersSectionTitle, { color: c.INK_SOFT }]}>Участники</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.membersScroll} contentContainerStyle={{ gap: 14, paddingHorizontal: 16 }}>
              {members.map(m => (
                <View key={m.user_id} style={st.memberItem}>
                  <View style={st.memberAvatarWrap}>
                    <Avatar url={m.avatar_url} name={m.name} size={44} />
                    {m.role === "admin" && (
                      <View style={[st.adminBadge, { backgroundColor: c.ACCENT, borderColor: c.SURFACE }]}>
                        <Feather name="star" size={8} color="#fff" />
                      </View>
                    )}
                  </View>
                  <Text style={[st.memberName, { color: c.INK_SOFT }]} numberOfLines={1}>{m.name?.split(" ")[0]}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={st.infoActions}>
          {!isCreator && (
            <TouchableOpacity
              style={st.leaveBtn}
              activeOpacity={0.8}
              onPress={() => { onClose(); setTimeout(onLeave, 250); }}
            >
              <Feather name="log-out" size={15} color="#e05a5a" />
              <Text style={st.leaveBtnText}>Покинуть группу</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

function ConfirmSheet({ visible, title, body, confirmLabel, danger, onConfirm, onClose }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
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
          st.confirmSheet, { backgroundColor: c.SURFACE, paddingBottom: insets.bottom + 16 },
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

const MsgBubble = memo(function MsgBubble({ msg, isMe, showSenderName, onLongPress, onLightbox }) {
  const c = useTheme();
  const images = useMemo(() => {
    if (!msg.images) return [];
    if (Array.isArray(msg.images)) return msg.images;
    try { return JSON.parse(msg.images); } catch { return []; }
  }, [msg.images]);

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onLongPress={() => isMe && onLongPress?.(msg)}
      delayLongPress={400}
    >
      <View style={[st.msgRow, isMe && st.msgRowMe]}>
        {!isMe && (
          showSenderName
            ? <Avatar url={msg.sender_avatar} name={msg.sender_name} size={28} />
            : <View style={{ width: 28 }} />
        )}
        <View style={[st.bubble, isMe ? [st.bubbleMe, { backgroundColor: c.ACCENT }] : [st.bubbleThem, { backgroundColor: c.SURFACE }]]}>
          {!isMe && showSenderName && (
            <Text style={[st.senderName, { color: c.ACCENT }]}>{msg.sender_name || "Участник"}</Text>
          )}

          {images.map((img, i) => (
            <TouchableOpacity key={i} onPress={() => onLightbox?.(images, i)}>
              <Image source={{ uri: assetUrl(img) }} style={st.msgImg} resizeMode="cover" />
            </TouchableOpacity>
          ))}

          {!!msg.body && !msg.deleted && (
            <Text style={[st.bubbleText, { color: isMe ? "#fff" : c.INK }]}>{msg.body}</Text>
          )}
          {!!msg.deleted && (
            <Text style={[st.bubbleText, st.deletedText, { color: isMe ? "rgba(255,255,255,0.6)" : c.INK_SOFT }]}>
              Сообщение удалено
            </Text>
          )}

          <View style={st.bubbleMeta}>
            <Text style={[st.bubbleTime, { color: isMe ? "rgba(255,255,255,0.7)" : c.INK_SOFT }]}>{fmtTime(msg.created_at)}</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
});

export default function GroupChatScreen({ route, navigation }) {
  const { group: initialGroup } = route.params;
  const me = useAuthStore(s => s.user);
  const insets = useSafeAreaInsets();
  const c = useTheme();

  const [msgs, setMsgs]           = useState([]);
  const [loading, setLoading]     = useState(true);
  const [text, setText]           = useState("");
  const [sending, setSending]     = useState(false);
  const [uploadingImg, setUploadingImg] = useState(false);
  const [lightboxData, setLightboxData] = useState(null);
  const [kbVisible, setKbVisible] = useState(false);

  const [group, setGroup]   = useState(initialGroup);
  const [members, setMembers] = useState([]);

  const [infoVisible, setInfoVisible]   = useState(false);
  const [msgSheet, setMsgSheet]         = useState(null);
  const [forwardTarget, setForwardTarget] = useState(null);
  const [leaveConfirm, setLeaveConfirm] = useState(false);

  useEffect(() => {
    const show = Keyboard.addListener("keyboardDidShow", () => setKbVisible(true));
    const hide  = Keyboard.addListener("keyboardDidHide", () => setKbVisible(false));
    return () => { show.remove(); hide.remove(); };
  }, []);

  const load = useCallback(async () => {
    try {
      const [ms, grpData] = await Promise.all([
        api(`/groups/${initialGroup.id}/messages`),
        api(`/groups/${initialGroup.id}`),
      ]);
      setMsgs(Array.isArray(ms) ? ms.reverse() : []);
      if (grpData) {
        setGroup(grpData);
        setMembers(Array.isArray(grpData.members) ? grpData.members : []);
      }
    } catch {}
    finally { setLoading(false); }
  }, [initialGroup.id]);

  useEffect(() => {
    load();

    const offMsg = wsOn("group:new_message", (m) => {
      if (!m.msg || m.msg.group_id !== initialGroup.id) return;
      setMsgs(prev => prev.some(x => x.id === m.msg.id) ? prev : [m.msg, ...prev]);
    });

    const offDel = wsOn("group:message_deleted", (m) => {
      if (m.groupId !== initialGroup.id) return;
      setMsgs(prev => prev.map(msg =>
        msg.id === m.msgId ? { ...msg, deleted: true, body: "" } : msg
      ));
    });

    const offMembers = wsOn("group:members_updated", (m) => {
      if (m.groupId !== initialGroup.id) return;
      if (Array.isArray(m.members)) setMembers(m.members);
    });

    return () => { offMsg(); offDel(); offMembers(); };
  }, [initialGroup.id]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setText("");
    setSending(true);
    haptic.light();
    try {
      const msg = await api(`/groups/${initialGroup.id}/messages`, { method: "POST", body: { body } });
      setMsgs(prev => prev.some(x => x.id === msg.id) ? prev : [msg, ...prev]);
    } catch { setText(body); }
    finally { setSending(false); }
  };

  const pickAndSendImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", selectionLimit: 4, quality: 0.85 });
    if (result.canceled || !result.assets?.length) return;
    setUploadingImg(true);
    haptic.light();
    try {
      const urls = await uploadAssets(result.assets);
      const msg = await api(`/groups/${initialGroup.id}/messages`, { method: "POST", body: { body: "", images: urls } });
      setMsgs(prev => prev.some(x => x.id === msg.id) ? prev : [msg, ...prev]);
      haptic.success();
    } catch {}
    setUploadingImg(false);
  };

  const handleDeleteMsg = async (msg) => {
    try {
      await api(`/groups/${initialGroup.id}/messages/${msg.id}`, { method: "DELETE" });
      setMsgs(prev => prev.map(m => m.id === msg.id ? { ...m, deleted: true, body: "" } : m));
    } catch {}
  };

  const handleLeave = async () => {
    try {
      await api(`/groups/${initialGroup.id}/leave`, { method: "POST" });
      navigation.goBack();
    } catch {}
  };

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

  const memberCount = members.length || group.member_count || 0;
  const isAdmin = members.some(m => m.user_id === me?.id && m.role === "admin");
  const isChannel = !!group.channel_mode;
  const canWrite = !isChannel || isAdmin;

  return (
    <KeyboardAvoidingView
      style={[st.root, { backgroundColor: c.BG }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + 10 : 0}
    >
      <View style={[st.header, { paddingTop: insets.top, backgroundColor: c.SURFACE, borderBottomColor: c.LINE }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={c.ACCENT} />
        </TouchableOpacity>
        <TouchableOpacity style={st.headerCenter} onPress={() => setInfoVisible(true)} activeOpacity={0.8}>
          <Avatar url={group.avatar_url} name={group.name} size={36} />
          <View style={st.headerInfo}>
            <View style={st.headerNameRow}>
              <Text style={[st.headerName, { color: c.INK }]} numberOfLines={1}>{group.name}</Text>
              {isChannel && (
                <View style={[st.channelBadge, { backgroundColor: `${c.ACCENT}18` }]}>
                  <Text style={[st.channelBadgeText, { color: c.ACCENT }]}>📢 Канал</Text>
                </View>
              )}
            </View>
            <Text style={[st.headerSub, { color: c.INK_SOFT }]}>{memberCount} участников</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={st.headerBtn}
          activeOpacity={0.7}
          onPress={() => navigation.navigate("GroupSettings", { group })}
        >
          <Feather name="settings" size={18} color={c.ACCENT} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={st.center}><ActivityIndicator color={c.ACCENT} size="large" /></View>
      ) : (
        <FlatList
          inverted
          data={listItems}
          keyExtractor={item => item._sep ? item.key : `msg-${item.id}`}
          renderItem={({ item, index }) => {
            if (item._sep) return <DateSep date={item.date} />;
            const isMe = item.sender_id === me?.id;
            const next = listItems[index + 1];
            const showSenderName = !isMe && (!next || next._sep || next.sender_id !== item.sender_id);
            return (
              <MsgBubble
                msg={item}
                isMe={isMe}
                showSenderName={showSenderName}
                onLongPress={(msg) => { haptic.medium(); setMsgSheet({ msg }); }}
                onLightbox={(imgs, idx) => setLightboxData({ images: imgs, index: idx })}
              />
            );
          }}
          contentContainerStyle={st.msgList}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          removeClippedSubviews
          maxToRenderPerBatch={12}
          windowSize={6}
          initialNumToRender={20}
          ListEmptyComponent={
            <View style={st.emptyMsgs}>
              <Text style={[st.emptyMsgsText, { color: c.INK_SOFT }]}>Начни общение в группе!</Text>
            </View>
          }
        />
      )}

      {canWrite ? (
        <View style={[st.inputWrap, { paddingBottom: (Platform.OS === "android" && kbVisible) ? 6 : insets.bottom + 6, backgroundColor: c.SURFACE, borderTopColor: c.LINE }]}>
          <TouchableOpacity onPress={pickAndSendImages} style={st.attachBtn} activeOpacity={0.7} disabled={uploadingImg}>
            {uploadingImg
              ? <ActivityIndicator size="small" color={c.ACCENT} />
              : <Feather name="image" size={20} color={c.INK_SOFT} />
            }
          </TouchableOpacity>
          <TextInput
            style={[st.input, { backgroundColor: c.WARM, color: c.INK }]}
            placeholder="Сообщение..."
            placeholderTextColor={c.INK_SOFT}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={4000}
          />
          <TouchableOpacity
            style={[st.sendBtn, { backgroundColor: c.ACCENT }, (!text.trim() || sending) && st.sendBtnOff]}
            onPress={send}
            disabled={!text.trim() || sending}
            activeOpacity={0.8}
          >
            {sending
              ? <ActivityIndicator color="#fff" size="small" />
              : <Feather name="send" size={17} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      ) : (
        <View style={[st.channelReadBar, { paddingBottom: (Platform.OS === "android" && kbVisible) ? 6 : insets.bottom + 6, backgroundColor: c.SURFACE, borderTopColor: c.LINE }]}>
          <Feather name="lock" size={15} color={c.INK_SOFT} style={{ marginRight: 7 }} />
          <Text style={[st.channelReadText, { color: c.INK_SOFT }]}>Только администраторы могут писать</Text>
        </View>
      )}

      <GroupInfoSheet
        visible={infoVisible}
        group={group}
        members={members}
        me={me}
        onClose={() => setInfoVisible(false)}
        onLeave={() => setLeaveConfirm(true)}
      />

      <ActionSheet
        visible={!!msgSheet}
        title="Сообщение"
        actions={[
          { icon: "corner-up-right", label: "Переслать", onPress: () => { setForwardTarget(msgSheet?.msg); setMsgSheet(null); } },
          { icon: "trash-2", label: "Удалить", danger: true, onPress: () => handleDeleteMsg(msgSheet?.msg) },
        ]}
        onClose={() => setMsgSheet(null)}
      />

      <ForwardModal
        visible={!!forwardTarget}
        message={forwardTarget}
        onClose={() => setForwardTarget(null)}
      />

      <ConfirmSheet
        visible={leaveConfirm}
        title="Покинуть группу?"
        body={`Ты больше не будешь видеть сообщения в «${group.name}».`}
        confirmLabel="Покинуть"
        danger
        onConfirm={handleLeave}
        onClose={() => setLeaveConfirm(false)}
      />

      {lightboxData && (
        <Lightbox
          images={lightboxData.images}
          initialIndex={lightboxData.index}
          visible={true}
          onClose={() => setLightboxData(null)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  root:         { flex: 1 },

  header:       { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: 1 },
  backBtn:      { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerInfo:   { flex: 1 },
  headerNameRow:  { flexDirection: "row", alignItems: "center", gap: 6 },
  headerName:   { fontSize: 15, fontWeight: "700" },
  headerSub:    { fontSize: 12, marginTop: 1 },
  headerBtn:    { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  channelBadge:     { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 8 },
  channelBadgeText: { fontSize: 11, fontWeight: "700" },
  center:       { flex: 1, alignItems: "center", justifyContent: "center" },

  msgList:      { padding: 10, paddingBottom: 4, gap: 2 },
  msgRow:       { flexDirection: "row", alignItems: "flex-end", gap: 6, marginVertical: 1 },
  msgRowMe:     { flexDirection: "row-reverse" },
  bubble:       { maxWidth: "75%", borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  bubbleMe:     { borderBottomRightRadius: 4 },
  bubbleThem:   { borderBottomLeftRadius: 4, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 3, elevation: 1 },
  senderName:   { fontSize: 11.5, fontWeight: "700", marginBottom: 2 },
  bubbleText:   { fontSize: 15, lineHeight: 21 },
  deletedText:  { fontStyle: "italic", opacity: 0.55, fontSize: 13 },
  bubbleMeta:   { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end" },
  bubbleTime:   { fontSize: 11 },
  msgImg:       { width: 200, height: 160, borderRadius: 10, marginBottom: 4 },
  dateSep:      { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 8 },
  dateLine:     { flex: 1, height: 1 },
  dateText:     { fontSize: 12, fontWeight: "600" },
  emptyMsgs:    { alignItems: "center", paddingTop: 60 },
  emptyMsgsText:{ fontSize: 15 },

  inputWrap:      { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: 1 },
  channelReadBar: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingTop: 14, borderTopWidth: 1 },
  channelReadText: { fontSize: 14, fontStyle: "italic" },
  attachBtn:    { width: 34, height: 40, alignItems: "center", justifyContent: "center" },
  input:        { flex: 1, minHeight: 40, maxHeight: 120, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15 },
  sendBtn:      { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  sendBtnOff:   { opacity: 0.35 },

  sheetBackdrop:  { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  sheet:          { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingHorizontal: 16 },
  sheetHeader:    { paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 4 },
  sheetTitle:     { fontSize: 15, fontWeight: "700", textAlign: "center" },
  sheetSubtitle:  { fontSize: 13, textAlign: "center", marginTop: 3 },
  sheetAction:    { flexDirection: "row", alignItems: "center", paddingVertical: 16, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth },
  sheetActionText: { fontSize: 15.5, flex: 1 },

  infoSheet:      { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 8 },
  dragHandle:     { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  infoHead:       { alignItems: "center", paddingHorizontal: 24, paddingBottom: 16, gap: 6 },
  infoName:       { fontSize: 20, fontWeight: "800" },
  typeBadge:      { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  typeBadgeText:  { fontSize: 12, fontWeight: "600" },
  infoHandle:     { fontSize: 13 },
  infoStats:      { flexDirection: "row", justifyContent: "center", paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, marginHorizontal: 16 },
  infoStat:       { alignItems: "center", paddingHorizontal: 24 },
  infoStatNum:    { fontSize: 22, fontWeight: "800" },
  infoStatLabel:  { fontSize: 12, marginTop: 2 },
  membersSection: { paddingTop: 16 },
  membersSectionTitle: { fontSize: 13, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, paddingHorizontal: 16, marginBottom: 10 },
  membersScroll:  { paddingBottom: 4 },
  memberItem:     { alignItems: "center", width: 56 },
  memberAvatarWrap: { position: "relative" },
  adminBadge:     { position: "absolute", bottom: 0, right: 0, width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  memberName:     { fontSize: 11.5, marginTop: 4, width: 56, textAlign: "center" },
  infoActions:    { paddingHorizontal: 16, paddingTop: 16 },
  leaveBtn:       { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 16, backgroundColor: "#fde8e8" },
  leaveBtnText:   { color: "#e05a5a", fontWeight: "700", fontSize: 15 },

  confirmSheet:   { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingHorizontal: 20 },
  confirmTitle:   { fontSize: 17, fontWeight: "800", textAlign: "center", marginTop: 8, marginBottom: 6 },
  confirmBody:    { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 20 },
  confirmBtns:    { flexDirection: "row", gap: 10, marginTop: 4 },
  confirmCancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: "center" },
  confirmCancelText: { fontWeight: "600", fontSize: 15 },
  confirmOkBtn:   { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: "center" },
  confirmOkText:  { fontWeight: "700", color: "#fff", fontSize: 15 },
});
