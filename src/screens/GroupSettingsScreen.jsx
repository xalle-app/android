import { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Switch, TextInput, ActivityIndicator, Modal, Animated, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import Avatar from "../components/Avatar.jsx";
import { api } from "../lib/api.js";
import { haptic } from "../lib/haptics.js";
import { useAuthStore } from "../store/auth.js";
import { useTheme } from "../store/theme.js";

function Section({ title }) {
  const c = useTheme();
  return <Text style={[st.sectionTitle, { color: c.INK_SOFT }]}>{title}</Text>;
}

function Card({ children }) {
  const c = useTheme();
  return <View style={[st.card, { backgroundColor: c.SURFACE }]}>{children}</View>;
}

function Divider() {
  const c = useTheme();
  return <View style={[st.divider, { backgroundColor: c.LINE }]} />;
}

function Row({ icon, label, sub, onPress, danger, right, value }) {
  const c = useTheme();
  const inner = (
    <View style={st.row}>
      {icon && (
        <View style={[st.iconWrap, { backgroundColor: danger ? "#e05a5a18" : `${c.ACCENT}12` }]}>
          <Feather name={icon} size={16} color={danger ? "#e05a5a" : c.ACCENT} />
        </View>
      )}
      <View style={st.rowBody}>
        <Text style={[st.rowLabel, { color: danger ? "#e05a5a" : c.INK }]}>{label}</Text>
        {!!sub && <Text style={[st.rowSub, { color: c.INK_SOFT }]}>{sub}</Text>}
      </View>
      {right !== undefined ? right : value
        ? <Text style={[st.rowValue, { color: c.INK_SOFT }]}>{value}</Text>
        : onPress ? <Feather name="chevron-right" size={16} color={c.INK_SOFT} /> : null}
    </View>
  );
  if (!onPress) return inner;
  return <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{inner}</TouchableOpacity>;
}

function ToggleRow({ icon, label, sub, value, onChange, disabled }) {
  const c = useTheme();
  return (
    <View style={st.row}>
      <View style={[st.iconWrap, { backgroundColor: `${c.ACCENT}12` }]}>
        <Feather name={icon} size={16} color={disabled ? c.INK_SOFT : c.ACCENT} />
      </View>
      <View style={st.rowBody}>
        <Text style={[st.rowLabel, { color: c.INK }]}>{label}</Text>
        {!!sub && <Text style={[st.rowSub, { color: c.INK_SOFT }]}>{sub}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ true: c.ACCENT, false: c.LINE }}
        thumbColor="#fff"
        ios_backgroundColor={c.LINE}
      />
    </View>
  );
}

function ConfirmSheet({ visible, title, body, confirmLabel, danger, onConfirm, onClose }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: visible ? 1 : 0, useNativeDriver: true, tension: 70, friction: 12 }).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={st.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[st.confirmSheet, { backgroundColor: c.SURFACE, paddingBottom: insets.bottom + 16 },
        { transform: [{ translateY: anim.interpolate({ inputRange: [0,1], outputRange: [300,0] }) }] }]}>
        <View style={[st.dragHandle, { backgroundColor: c.LINE }]} />
        <Text style={[st.confirmTitle, { color: c.INK }]}>{title}</Text>
        {!!body && <Text style={[st.confirmBody, { color: c.INK_SOFT }]}>{body}</Text>}
        <View style={st.confirmBtns}>
          <TouchableOpacity style={[st.cancelBtn, { backgroundColor: c.WARM }]} onPress={onClose} activeOpacity={0.8}>
            <Text style={[st.cancelBtnText, { color: c.INK_SOFT }]}>Отмена</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[st.okBtn, { backgroundColor: danger ? "#e05a5a" : c.ACCENT }]}
            onPress={() => { onClose(); setTimeout(onConfirm, 200); }}
            activeOpacity={0.8}
          >
            <Text style={st.okBtnText}>{confirmLabel || "Подтвердить"}</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

function EditNameSheet({ visible, currentName, onSave, onClose }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;
  const [val, setVal] = useState(currentName || "");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) setVal(currentName || "");
    Animated.spring(anim, { toValue: visible ? 1 : 0, useNativeDriver: true, tension: 70, friction: 12 }).start();
  }, [visible, currentName]);

  const save = async () => {
    const n = val.trim();
    if (!n) return;
    setBusy(true);
    try { await onSave(n); onClose(); }
    catch (e) { Alert.alert("Ошибка", e.message); }
    finally { setBusy(false); }
  };

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={st.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[st.editSheet, { backgroundColor: c.SURFACE, paddingBottom: insets.bottom + 20 },
        { transform: [{ translateY: anim.interpolate({ inputRange: [0,1], outputRange: [300,0] }) }] }]}>
        <View style={[st.dragHandle, { backgroundColor: c.LINE }]} />
        <Text style={[st.editSheetTitle, { color: c.INK }]}>Название группы</Text>
        <TextInput
          style={[st.editInput, { backgroundColor: c.WARM, borderColor: c.LINE, color: c.INK }]}
          value={val}
          onChangeText={setVal}
          placeholder="Введите название..."
          placeholderTextColor={c.INK_SOFT}
          maxLength={100}
          autoFocus
        />
        <TouchableOpacity
          style={[st.okBtn, { backgroundColor: c.ACCENT, marginTop: 8 }, (!val.trim() || busy) && { opacity: 0.4 }]}
          onPress={save}
          disabled={!val.trim() || busy}
          activeOpacity={0.85}
        >
          {busy
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={st.okBtnText}>Сохранить</Text>
          }
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const GROUP_TYPES = [
  { value: "open",    label: "Открытая",        sub: "Любой может вступить",              icon: "globe" },
  { value: "request", label: "По заявке",        sub: "Вступление через одобрение админа", icon: "user-check" },
  { value: "closed",  label: "Закрытая",         sub: "Только по приглашению",             icon: "lock" },
];

function TypePickerSheet({ visible, current, onSelect, onClose }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(anim, { toValue: visible ? 1 : 0, useNativeDriver: true, tension: 70, friction: 12 }).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible} onRequestClose={onClose}>
      <TouchableOpacity style={st.backdrop} activeOpacity={1} onPress={onClose} />
      <Animated.View style={[st.typeSheet, { backgroundColor: c.SURFACE, paddingBottom: insets.bottom + 16 },
        { transform: [{ translateY: anim.interpolate({ inputRange: [0,1], outputRange: [350,0] }) }] }]}>
        <View style={[st.dragHandle, { backgroundColor: c.LINE }]} />
        <Text style={[st.editSheetTitle, { color: c.INK }]}>Тип группы</Text>
        {GROUP_TYPES.map(t => (
          <TouchableOpacity key={t.value} style={[st.typeRow, { borderBottomColor: c.LINE }]} onPress={() => { onSelect(t.value); onClose(); }} activeOpacity={0.8}>
            <View style={[st.iconWrap, { backgroundColor: current === t.value ? `${c.ACCENT}18` : `${c.ACCENT}08` }]}>
              <Feather name={t.icon} size={16} color={current === t.value ? c.ACCENT : c.INK_SOFT} />
            </View>
            <View style={st.rowBody}>
              <Text style={[st.rowLabel, { color: current === t.value ? c.ACCENT : c.INK }, current === t.value && { fontWeight: "700" }]}>{t.label}</Text>
              <Text style={[st.rowSub, { color: c.INK_SOFT }]}>{t.sub}</Text>
            </View>
            {current === t.value && <Feather name="check" size={16} color={c.ACCENT} />}
          </TouchableOpacity>
        ))}
      </Animated.View>
    </Modal>
  );
}

function MemberRow({ member, isAdmin, isSelf, onKick }) {
  const c = useTheme();
  return (
    <View style={st.memberRow}>
      <Avatar url={member.avatar_url} name={member.name} size={40} />
      <View style={st.rowBody}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Text style={[st.memberName, { color: c.INK }]}>{member.name}</Text>
          {member.role === "admin" && (
            <View style={[st.adminChip, { backgroundColor: `${c.ACCENT}15` }]}>
              <Feather name="star" size={9} color={c.ACCENT} />
              <Text style={[st.adminChipText, { color: c.ACCENT }]}>Адм.</Text>
            </View>
          )}
        </View>
        <Text style={[st.memberHandle, { color: c.INK_SOFT }]}>@{member.handle}</Text>
      </View>
      {isAdmin && !isSelf && member.role !== "admin" && (
        <TouchableOpacity
          style={st.kickBtn}
          onPress={onKick}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Feather name="user-x" size={16} color="#e05a5a" />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function GroupSettingsScreen({ route, navigation }) {
  const { group: initialGroup } = route.params;
  const insets = useSafeAreaInsets();
  const me = useAuthStore(s => s.user);
  const c = useTheme();

  const [group, setGroup]     = useState(initialGroup);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);

  const [editNameVisible, setEditNameVisible]   = useState(false);
  const [typePickerVisible, setTypePickerVisible] = useState(false);
  const [leaveConfirm, setLeaveConfirm]           = useState(false);
  const [kickTarget, setKickTarget]               = useState(null);

  const amAdmin = members.find(m => m.user_id === me?.id)?.role === "admin";
  const isCreator = group.creator_id === me?.id;

  const load = useCallback(async () => {
    try {
      const g = await api(`/groups/${initialGroup.id}`);
      if (g) {
        setGroup(g);
        setMembers(Array.isArray(g.members) ? g.members : []);
      }
    } catch {}
    finally { setLoading(false); }
  }, [initialGroup.id]);

  useEffect(() => { load(); }, []);

  const patch = async (body) => {
    setSaving(true);
    try {
      const g = await api(`/groups/${initialGroup.id}`, { method: "PATCH", body });
      setGroup(g);
      setMembers(Array.isArray(g.members) ? g.members : []);
      haptic.success();
    } catch (e) {
      Alert.alert("Ошибка", e.message);
    }
    finally { setSaving(false); }
  };

  const kickMember = async (userId) => {
    try {
      await api(`/groups/${initialGroup.id}/members/${userId}`, { method: "DELETE" });
      setMembers(prev => prev.filter(m => m.user_id !== userId));
      haptic.success();
    } catch (e) {
      Alert.alert("Ошибка", e.message);
    }
  };

  const leaveGroup = async () => {
    try {
      await api(`/groups/${initialGroup.id}/leave`, { method: "POST" });
      navigation.pop(2);
    } catch (e) {
      Alert.alert("Ошибка", e.message);
    }
  };

  const typeLabel = GROUP_TYPES.find(t => t.value === group.type)?.label || "Открытая";

  return (
    <View style={[st.root, { paddingTop: insets.top, backgroundColor: c.BG }]}>
      <View style={[st.header, { backgroundColor: c.SURFACE, borderBottomColor: c.LINE }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={c.ACCENT} />
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: c.INK }]}>Настройки группы</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={st.center}><ActivityIndicator color={c.ACCENT} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>

          <View style={[st.heroCard, { backgroundColor: c.SURFACE }]}>
            <Avatar url={group.avatar_url} name={group.name} size={64} />
            <View style={st.heroInfo}>
              <Text style={[st.heroName, { color: c.INK }]} numberOfLines={1}>{group.name}</Text>
              {group.handle && <Text style={[st.heroHandle, { color: c.INK_SOFT }]}>@{group.handle}</Text>}
              <Text style={[st.heroCnt, { color: c.INK_SOFT }]}>{members.length} участников</Text>
            </View>
          </View>

          {amAdmin && (
            <>
              <Section title="Информация" />
              <Card>
                <Row icon="edit-2" label="Название" value={group.name} onPress={() => setEditNameVisible(true)} />
                <Divider />
                <Row icon="shield" label="Тип группы" value={typeLabel} onPress={() => setTypePickerVisible(true)} />
              </Card>
            </>
          )}

          {amAdmin && (
            <>
              <Section title="Режим канала" />
              <Card>
                <ToggleRow
                  icon="radio"
                  label="Режим канала"
                  sub="Только администраторы могут писать сообщения. Остальные читают и ставят реакции."
                  value={!!group.channel_mode}
                  onChange={v => patch({ channel_mode: v })}
                />
              </Card>
            </>
          )}

          {group.pinnedMsg && (
            <>
              <Section title="Закреплённое сообщение" />
              <Card>
                <View style={st.pinnedMsg}>
                  <Feather name="bookmark" size={14} color={c.ACCENT} style={{ marginTop: 2 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[st.pinnedSender, { color: c.ACCENT }]}>{group.pinnedMsg.sender_name}</Text>
                    <Text style={[st.pinnedBody, { color: c.INK }]} numberOfLines={3}>{group.pinnedMsg.body}</Text>
                  </View>
                  {amAdmin && (
                    <TouchableOpacity
                      onPress={() => patch({ pinned_message_id: null })}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      activeOpacity={0.7}
                    >
                      <Feather name="x" size={16} color={c.INK_SOFT} />
                    </TouchableOpacity>
                  )}
                </View>
              </Card>
            </>
          )}

          <Section title={`Участники · ${members.length}`} />
          <Card>
            {members.map((m, i) => (
              <View key={m.user_id}>
                <MemberRow
                  member={m}
                  isAdmin={amAdmin}
                  isSelf={m.user_id === me?.id}
                  onKick={() => setKickTarget(m)}
                />
                {i < members.length - 1 && <Divider />}
              </View>
            ))}
          </Card>

          <Section title="Действия" />
          <Card>
            {!isCreator && (
              <Row icon="log-out" label="Покинуть группу" onPress={() => setLeaveConfirm(true)} danger />
            )}
          </Card>
        </ScrollView>
      )}

      <EditNameSheet
        visible={editNameVisible}
        currentName={group.name}
        onSave={(name) => patch({ name })}
        onClose={() => setEditNameVisible(false)}
      />

      <TypePickerSheet
        visible={typePickerVisible}
        current={group.type}
        onSelect={(type) => patch({ type })}
        onClose={() => setTypePickerVisible(false)}
      />

      <ConfirmSheet
        visible={leaveConfirm}
        title="Покинуть группу?"
        body={`Ты больше не будешь видеть сообщения в «${group.name}».`}
        confirmLabel="Покинуть"
        danger
        onConfirm={leaveGroup}
        onClose={() => setLeaveConfirm(false)}
      />

      <ConfirmSheet
        visible={!!kickTarget}
        title={`Исключить ${kickTarget?.name}?`}
        body="Участник потеряет доступ к группе."
        confirmLabel="Исключить"
        danger
        onConfirm={() => kickMember(kickTarget?.user_id)}
        onClose={() => setKickTarget(null)}
      />
    </View>
  );
}

const st = StyleSheet.create({
  root:           { flex: 1 },
  header:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn:        { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle:    { fontSize: 15, fontWeight: "700" },
  center:         { flex: 1, alignItems: "center", justifyContent: "center" },

  heroCard:       { flexDirection: "row", alignItems: "center", gap: 16, margin: 16, borderRadius: 18, padding: 18, shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
  heroInfo:       { flex: 1 },
  heroName:       { fontSize: 18, fontWeight: "800" },
  heroHandle:     { fontSize: 13, marginTop: 2 },
  heroCnt:        { fontSize: 12.5, marginTop: 4 },

  sectionTitle:   { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, paddingHorizontal: 20, paddingBottom: 8, paddingTop: 20 },
  card:           { marginHorizontal: 16, borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  divider:        { height: StyleSheet.hairlineWidth, marginLeft: 60 },

  row:            { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  iconWrap:       { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  rowBody:        { flex: 1 },
  rowLabel:       { fontSize: 15, fontWeight: "500" },
  rowSub:         { fontSize: 12.5, marginTop: 1 },
  rowValue:       { fontSize: 13.5 },

  memberRow:      { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  memberName:     { fontSize: 14.5, fontWeight: "600" },
  memberHandle:   { fontSize: 12.5 },
  adminChip:      { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  adminChipText:  { fontSize: 10, fontWeight: "700" },
  kickBtn:        { width: 32, height: 32, borderRadius: 8, backgroundColor: "#e05a5a15", alignItems: "center", justifyContent: "center" },

  pinnedMsg:      { flexDirection: "row", gap: 10, padding: 14, alignItems: "flex-start" },
  pinnedSender:   { fontSize: 12, fontWeight: "700", marginBottom: 2 },
  pinnedBody:     { fontSize: 13.5, lineHeight: 19 },

  backdrop:       { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.45)" },
  confirmSheet:   { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingHorizontal: 20 },
  dragHandle:     { width: 36, height: 4, borderRadius: 2, alignSelf: "center", marginBottom: 16 },
  confirmTitle:   { fontSize: 17, fontWeight: "800", textAlign: "center", marginBottom: 6 },
  confirmBody:    { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 16 },
  confirmBtns:    { flexDirection: "row", gap: 10, marginTop: 4 },
  cancelBtn:      { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: "center" },
  cancelBtnText:  { fontWeight: "600", fontSize: 15 },
  okBtn:          { flex: 1, paddingVertical: 14, borderRadius: 16, alignItems: "center" },
  okBtnText:      { fontWeight: "700", color: "#fff", fontSize: 15 },

  editSheet:      { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingHorizontal: 20, gap: 12 },
  editSheetTitle: { fontSize: 16, fontWeight: "800", textAlign: "center", marginBottom: 4 },
  editInput:      { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },

  typeSheet:      { position: "absolute", bottom: 0, left: 0, right: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 8, paddingHorizontal: 16 },
  typeRow:        { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 4, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
});
