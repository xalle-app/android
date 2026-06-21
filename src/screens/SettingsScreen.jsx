import { useState, useEffect, useRef, useMemo } from "react";
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, ActivityIndicator, Alert, Switch, Image,
} from "react-native";
import * as LocalAuthentication from "expo-local-authentication";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import Avatar from "../components/Avatar.jsx";
import FeedbackModal from "../components/FeedbackModal.jsx";
import { api, assetUrl } from "../lib/api.js";
import { uploadAvatar } from "../lib/upload.js";
import { haptic } from "../lib/haptics.js";
import { useAuthStore } from "../store/auth.js";
import { useThemeStore, useTheme } from "../store/theme.js";

// ── Gradient presets (mirrors old client) ─────────────────────────────────
export const GRADIENT_PRESETS = [
  { label: "Нет",           value: null,       colors: null },
  { label: "Фиолет-синий",  value: "linear-gradient(135deg, #a78bfa, #60a5fa)", colors: ["#a78bfa", "#60a5fa"] },
  { label: "Океан",         value: "linear-gradient(135deg, #06b6d4, #3b82f6)", colors: ["#06b6d4", "#3b82f6"] },
  { label: "Аврора",        value: "linear-gradient(135deg, #34d399, #60a5fa)", colors: ["#34d399", "#60a5fa"] },
  { label: "Закат",         value: "linear-gradient(135deg, #f59e0b, #a78bfa)", colors: ["#f59e0b", "#a78bfa"] },
  { label: "Сакура",        value: "linear-gradient(135deg, #f472b6, #a78bfa)", colors: ["#f472b6", "#a78bfa"] },
];

// ── Color palette (same as old client) ────────────────────────────────────
const NAME_COLORS = [
  { label: "Стандарт",  value: null },
  { label: "Роза",      value: "#d65f7a" },
  { label: "Закат",     value: "#c8745a" },
  { label: "Янтарь",    value: "#d99a2b" },
  { label: "Изумруд",   value: "#5b9e6e" },
  { label: "Сапфир",    value: "#5fa8d3" },
  { label: "Аметист",   value: "#b56db0" },
  { label: "Лаванда",   value: "#7a7ec8" },
  { label: "Коралл",    value: "#e07a5f" },
];

// ── Parse gradient string → colors array ─────────────────────────────────
function parseGradientColors(gradStr) {
  if (!gradStr) return null;
  const m = gradStr.match(/#[0-9a-fA-F]{6}/g);
  return m?.length >= 2 ? m : null;
}

// ── Gradient name display (gradient pill) ────────────────────────────────
function GradientName({ name, gradient, color, style }) {
  const colors = parseGradientColors(gradient);
  if (!colors) {
    return <Text style={[style, color ? { color } : null]}>{name}</Text>;
  }
  // Extract font-related styles to apply on Text; layout styles on the container
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 0 }}
      style={st.gradNamePill}
    >
      <Text style={[style, { color: "#fff" }]}>{name}</Text>
    </LinearGradient>
  );
}

// ── Reusable primitives (themed via useTheme) ─────────────────────────────
function SectionHeader({ title }) {
  const c = useTheme();
  return <Text style={[st.sectionTitle, { color: c.INK_SOFT }]}>{title}</Text>;
}

function Card({ children, style }) {
  const c = useTheme();
  return <View style={[st.card, { backgroundColor: c.SURFACE }, style]}>{children}</View>;
}

function Divider() {
  const c = useTheme();
  return <View style={[st.divider, { backgroundColor: c.LINE }]} />;
}

function Row({ icon, label, sub, value, onPress, danger, right }) {
  const c = useTheme();
  const inner = (
    <View style={st.row}>
      {icon && (
        <View style={[st.iconWrap, { backgroundColor: `${c.ACCENT}12` }, danger && st.iconWrapDanger]}>
          <Feather name={icon} size={16} color={danger ? "#e05a5a" : c.ACCENT} />
        </View>
      )}
      <View style={st.rowBody}>
        <Text style={[st.rowLabel, { color: c.INK }, danger && st.danger]}>{label}</Text>
        {!!sub && <Text style={[st.rowSub, { color: c.INK_SOFT }]} numberOfLines={2}>{sub}</Text>}
      </View>
      {right !== undefined
        ? right
        : onPress
          ? <Feather name="chevron-right" size={16} color={c.INK_SOFT} />
          : value
            ? <Text style={[st.rowValue, { color: c.INK_SOFT }]}>{value}</Text>
            : null
      }
    </View>
  );
  if (!onPress) return inner;
  return <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{inner}</TouchableOpacity>;
}

function ToggleRow({ icon, label, sub, value, onChange }) {
  const c = useTheme();
  return (
    <View style={st.row}>
      {icon && (
        <View style={[st.iconWrap, { backgroundColor: `${c.ACCENT}12` }]}>
          <Feather name={icon} size={16} color={c.ACCENT} />
        </View>
      )}
      <View style={st.rowBody}>
        <Text style={[st.rowLabel, { color: c.INK }]}>{label}</Text>
        {!!sub && <Text style={[st.rowSub, { color: c.INK_SOFT }]}>{sub}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: c.ACCENT, false: c.LINE }}
        thumbColor="#fff"
        ios_backgroundColor={c.LINE}
      />
    </View>
  );
}

function EditField({ label, value, onSave, placeholder, multiline }) {
  const c = useTheme();
  const [editing, setEditing] = useState(false);
  const [text, setText]       = useState(value || "");
  const [busy, setBusy]       = useState(false);

  useEffect(() => { if (!editing) setText(value || ""); }, [value, editing]);

  const save = async () => {
    setBusy(true);
    try { await onSave(text.trim()); setEditing(false); }
    catch (e) { Alert.alert("Ошибка", e.message); }
    finally { setBusy(false); }
  };

  if (editing) {
    return (
      <View style={st.editBox}>
        <TextInput
          style={[st.editInput, { backgroundColor: c.WARM, borderColor: c.LINE, color: c.INK }, multiline && { height: 80, textAlignVertical: "top" }]}
          value={text}
          onChangeText={setText}
          placeholder={placeholder}
          placeholderTextColor={c.INK_SOFT}
          multiline={multiline}
          autoFocus
        />
        <View style={st.editActions}>
          <TouchableOpacity onPress={() => setEditing(false)} style={st.editCancel}>
            <Text style={[st.editCancelText, { color: c.INK_SOFT }]}>Отмена</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={save} disabled={busy} style={[st.editSave, { backgroundColor: c.ACCENT }]}>
            {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={st.editSaveText}>Сохранить</Text>}
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity style={st.row} onPress={() => setEditing(true)} activeOpacity={0.7}>
      <View style={st.rowBody}>
        <Text style={[st.rowLabel, { color: c.INK }]}>{label}</Text>
        <Text style={[st.rowSub, { color: c.INK_SOFT }]} numberOfLines={2}>{value || "—"}</Text>
      </View>
      <Feather name="edit-2" size={15} color={c.INK_SOFT} />
    </TouchableOpacity>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────
export default function SettingsScreen({ navigation }) {
  const insets     = useSafeAreaInsets();
  const c          = useTheme();
  const user       = useAuthStore(s => s.user);
  const updateUser = useAuthStore(s => s.updateUser);
  const logout     = useAuthStore(s => s.logout);
  const themeMode  = useThemeStore(s => s.mode);
  const setThemeMode = useThemeStore(s => s.setMode);

  // Notification toggles
  const [notifDm,       setNotifDm]       = useState(true);
  const [notifReplies,  setNotifReplies]  = useState(true);
  const [notifMentions, setNotifMentions] = useState(true);
  const [notifLikes,    setNotifLikes]    = useState(true);
  const [notifFollow,   setNotifFollow]   = useState(true);

  // Privacy toggles
  const [showOnline,    setShowOnline]    = useState(true);
  const [readReceipts,  setReadReceipts]  = useState(true);

  // Biometric lock
  const [bioAvailable,  setBioAvailable]  = useState(false);
  const [bioLock,       setBioLock]       = useState(false);

  // Feedback
  const [showFeedback, setShowFeedback] = useState(false);

  // Avatar
  const [avatarBusy, setAvatarBusy] = useState(false);

  // Full settings object — needed for proper merge on save
  const settingsRef = useRef({});

  useEffect(() => {
    api("/settings").then(s => {
      if (!s) return;
      settingsRef.current = s;
      const n = s.notifs || {};
      setNotifDm(n.dm !== false);
      setNotifReplies(n.replies !== false);
      setNotifMentions(n.mentions !== false);
      setNotifLikes(n.likes !== false);
      setNotifFollow(n.follow !== false);
      const p = s.privacy || {};
      setShowOnline(p.showOnline !== false);
      setReadReceipts(p.readReceipts !== false);
    }).catch(() => {});

    LocalAuthentication.hasHardwareAsync().then(has => {
      if (!has) return;
      return LocalAuthentication.isEnrolledAsync().then(enrolled => {
        setBioAvailable(enrolled);
      });
    }).catch(() => {});

    import("expo-secure-store").then(SecureStore => {
      SecureStore.getItemAsync("bio_lock").then(v => {
        setBioLock(v === "1");
      }).catch(() => {});
    }).catch(() => {});
  }, []);

  const saveSettings = (patch) => {
    const merged = { ...settingsRef.current, ...patch };
    settingsRef.current = merged;
    api("/settings", { method: "PUT", body: merged }).catch(() => {});
  };

  const saveNotif = (key, val) => {
    const n = { dm: notifDm, replies: notifReplies, mentions: notifMentions, likes: notifLikes, follow: notifFollow, [key]: val };
    saveSettings({ notifs: n });
  };

  const savePrivacy = (key, val) => {
    const p = { showOnline: showOnline, readReceipts: readReceipts, [key]: val };
    saveSettings({ privacy: p });
  };

  const saveName = async (name) => {
    if (!name) return;
    await api("/profile/name", { method: "PATCH", body: { name } });
    updateUser({ name });
  };

  const saveBio = async (bio) => {
    await api("/profile/bio", { method: "PATCH", body: { bio } });
    updateUser({ bio });
  };

  const saveNameColor = (color) => {
    const prev = user?.name_color ?? null;
    updateUser({ name_color: color });
    haptic.success();
    api("/profile/name-color", { method: "PATCH", body: { color } }).catch(e => {
      updateUser({ name_color: prev });
      Alert.alert("Ошибка", e.message);
    });
  };

  const saveNameGradient = (gradient) => {
    const prev = user?.name_gradient ?? null;
    updateUser({ name_gradient: gradient });
    haptic.success();
    api("/profile/name-gradient", { method: "PATCH", body: { gradient } }).catch(e => {
      updateUser({ name_gradient: prev });
      Alert.alert("Ошибка", e.message || "Градиент доступен только в Xalle Premium");
    });
  };

  const pickAvatar = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert("Нет доступа", "Разреши доступ к галерее в настройках."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: "images",
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.length) return;
    setAvatarBusy(true);
    try {
      const { url } = await uploadAvatar(result.assets[0]);
      updateUser({ avatar_url: url });
      haptic.success();
    } catch (e) {
      Alert.alert("Ошибка", e.message || "Не удалось загрузить аватар");
    } finally {
      setAvatarBusy(false);
    }
  };

  const deleteAvatar = () => {
    Alert.alert("Удалить аватар?", "", [
      { text: "Отмена", style: "cancel" },
      { text: "Удалить", style: "destructive", onPress: async () => {
        await api("/avatar", { method: "DELETE" }).catch(() => {});
        updateUser({ avatar_url: null });
      }},
    ]);
  };

  const toggleBioLock = async (val) => {
    if (val) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Подтверди отпечаток для включения блокировки",
        cancelLabel: "Отмена",
      });
      if (!result.success) return;
    }
    setBioLock(val);
    import("expo-secure-store").then(SecureStore => {
      SecureStore.setItemAsync("bio_lock", val ? "1" : "0");
    }).catch(() => {});
  };

  const confirmLogout = () => {
    Alert.alert("Выйти из аккаунта?", "Ты выйдешь на экран входа.", [
      { text: "Отмена", style: "cancel" },
      { text: "Выйти", style: "destructive", onPress: logout },
    ]);
  };

  const joined = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("ru-RU", { year: "numeric", month: "long" })
    : null;

  const currentColor = user?.name_color || null;

  return (
    <View style={[st.root, { paddingTop: insets.top, backgroundColor: c.BG }]}>
      {/* Header */}
      <View style={[st.header, { backgroundColor: c.SURFACE, borderBottomColor: c.LINE }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} activeOpacity={0.7} style={[st.backBtn, { backgroundColor: c.WARM }]}>
          <Feather name="arrow-left" size={20} color={c.INK} />
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: c.INK }]}>Настройки</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 40 }} showsVerticalScrollIndicator={false}>

        {/* Profile hero */}
        <View style={[st.heroCard, { backgroundColor: c.SURFACE }]}>
          <TouchableOpacity onPress={pickAvatar} activeOpacity={0.8} style={st.avatarWrap} disabled={avatarBusy}>
            <Avatar url={user?.avatar_url} name={user?.name} size={68} />
            <View style={[st.avatarOverlay, { backgroundColor: c.ACCENT, borderColor: c.SURFACE }]}>
              {avatarBusy
                ? <ActivityIndicator size="small" color="#fff" />
                : <Feather name="camera" size={16} color="#fff" />
              }
            </View>
          </TouchableOpacity>
          <View style={st.heroInfo}>
            <GradientName name={user?.name || "—"} gradient={user?.name_gradient} color={user?.name_color} style={[st.heroName, { color: c.INK }]} />
            <Text style={[st.heroHandle, { color: c.INK_SOFT }]}>@{user?.handle}</Text>
            {joined && <Text style={[st.heroJoined, { color: c.INK_SOFT }]}>На xalle с {joined}</Text>}
            {user?.avatar_url && (
              <TouchableOpacity onPress={deleteAvatar} style={st.deleteAvaBtn}>
                <Text style={st.deleteAvaBtnText}>Удалить фото</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Xalle Plus */}
        <SectionHeader title="Подписка" />
        <Card>
          <Row
            icon="star"
            label="Xalle Plus"
            sub={user?.subscription_tier >= 4 ? "Premium активен" : user?.subscription_tier >= 1 ? "Plus активен" : "Получи особые возможности"}
            onPress={() => navigation.navigate("XallePlus")}
          />
        </Card>

        {/* Профиль */}
        <SectionHeader title="Профиль" />
        <Card>
          <EditField label="Имя" value={user?.name} onSave={saveName} placeholder="Твоё имя" />
          <Divider />
          <EditField label="О себе" value={user?.bio} onSave={saveBio} placeholder="Напиши что-нибудь о себе" multiline />
          <Divider />
          <Row icon="at-sign" label="Ник" value={`@${user?.handle || "—"}`} />
          <Divider />
          <Row icon="mail" label="Email" value={user?.email || "—"} />
        </Card>

        {/* Цвет имени */}
        <SectionHeader title="Цвет имени" />
        <Card style={st.colorCard}>
          <Text style={[st.colorLabel, { color: c.INK_SOFT }]}>Выбери цвет для своего имени</Text>
          <View style={st.colorRow}>
            {NAME_COLORS.map(clr => {
              const isActive = currentColor === clr.value;
              return (
                <TouchableOpacity
                  key={clr.label}
                  style={[st.colorDot, isActive && { backgroundColor: `${c.ACCENT}18` }]}
                  onPress={() => saveNameColor(clr.value)}
                  activeOpacity={0.75}
                >
                  <View style={[
                    st.colorDotInner,
                    { backgroundColor: clr.value || c.INK_SOFT },
                    isActive && st.colorDotInnerActive,
                  ]} />
                  {isActive && (
                    <View style={[st.colorCheck, { backgroundColor: c.ACCENT }]}>
                      <Feather name="check" size={10} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          <Text style={[st.colorPreview, { color: c.INK_SOFT }]} numberOfLines={1}>
            Предпросмотр: <Text style={currentColor && !user?.name_gradient ? { color: currentColor, fontWeight: "700" } : { fontWeight: "700", color: c.INK }}>{user?.name || "Имя"}</Text>
          </Text>
        </Card>

        {/* Градиент имени (Premium) */}
        <SectionHeader title="Градиент имени" />
        <Card style={st.gradCard}>
          <Text style={[st.colorLabel, { color: c.INK_SOFT }]}>Только для Xalle Premium · Перекрашивает имя</Text>
          <View style={st.colorRow}>
            {GRADIENT_PRESETS.map(g => {
              const isActive = (user?.name_gradient || null) === g.value;
              return (
                <TouchableOpacity
                  key={g.label}
                  style={[st.gradDot, isActive && { backgroundColor: `${c.ACCENT}18` }]}
                  onPress={() => saveNameGradient(g.value)}
                  activeOpacity={0.75}
                >
                  {g.colors ? (
                    <LinearGradient
                      colors={g.colors}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={[st.gradDotInner, isActive && st.colorDotInnerActive]}
                    />
                  ) : (
                    <View style={[st.gradDotInner, { backgroundColor: c.INK_SOFT }, isActive && st.colorDotInnerActive]}>
                      <Feather name="slash" size={13} color="#fff" />
                    </View>
                  )}
                  {isActive && (
                    <View style={[st.colorCheck, { backgroundColor: c.ACCENT }]}>
                      <Feather name="check" size={10} color="#fff" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
          {user?.name_gradient && (
            <View style={st.gradPreviewWrap}>
              <Text style={[st.colorPreview, { color: c.INK_SOFT }]}>Предпросмотр: </Text>
              <GradientName name={user?.name || "Имя"} gradient={user.name_gradient} style={[st.colorPreview, { fontWeight: "700" }]} />
            </View>
          )}
        </Card>

        {/* Уведомления */}
        <SectionHeader title="Уведомления" />
        <Card>
          <ToggleRow icon="message-circle" label="Сообщения" sub="Новые личные сообщения" value={notifDm} onChange={v => { setNotifDm(v); saveNotif("dm", v); }} />
          <Divider />
          <ToggleRow icon="corner-down-right" label="Ответы" sub="Ответы на твои посты" value={notifReplies} onChange={v => { setNotifReplies(v); saveNotif("replies", v); }} />
          <Divider />
          <ToggleRow icon="at-sign" label="Упоминания" sub="Когда тебя упоминают" value={notifMentions} onChange={v => { setNotifMentions(v); saveNotif("mentions", v); }} />
          <Divider />
          <ToggleRow icon="heart" label="Реакции" sub="Реакции на посты" value={notifLikes} onChange={v => { setNotifLikes(v); saveNotif("likes", v); }} />
          <Divider />
          <ToggleRow icon="user-plus" label="Подписки" sub="Новые подписчики" value={notifFollow} onChange={v => { setNotifFollow(v); saveNotif("follow", v); }} />
        </Card>

        {/* Приватность */}
        <SectionHeader title="Приватность" />
        <Card>
          <ToggleRow icon="wifi" label="Показывать онлайн" sub="Другие видят, когда ты в сети" value={showOnline} onChange={v => { setShowOnline(v); savePrivacy("showOnline", v); }} />
          <Divider />
          <ToggleRow icon="check-circle" label="Статус прочтения" sub="Отображать ✓✓ когда прочитано" value={readReceipts} onChange={v => { setReadReceipts(v); savePrivacy("readReceipts", v); }} />
          <Divider />
          <Row icon="users" label="Кто видит мои посты" sub="Все пользователи" onPress={() => {}} />
          <Divider />
          <Row icon="message-square" label="Кто может написать мне" sub="Все пользователи" onPress={() => {}} />
        </Card>

        {/* Тема */}
        <SectionHeader title="Внешний вид" />
        <Card>
          {[
            { id: "light", label: "Светлая", icon: "sun" },
            { id: "dark",  label: "Тёмная",  icon: "moon" },
            { id: "system", label: "Как в системе", icon: "smartphone" },
          ].map((opt, i, arr) => (
            <View key={opt.id}>
              <TouchableOpacity style={st.row} onPress={() => setThemeMode(opt.id)} activeOpacity={0.7}>
                <View style={[st.iconWrap, { backgroundColor: `${c.ACCENT}12` }]}>
                  <Feather name={opt.icon} size={16} color={c.ACCENT} />
                </View>
                <View style={st.rowBody}>
                  <Text style={[st.rowLabel, { color: c.INK }]}>{opt.label}</Text>
                </View>
                {themeMode === opt.id && <Feather name="check" size={16} color={c.ACCENT} />}
              </TouchableOpacity>
              {i < arr.length - 1 && <Divider />}
            </View>
          ))}
        </Card>

        {/* Аккаунт */}
        <SectionHeader title="Аккаунт" />
        <Card>
          <Row icon="lock" label="Сменить пароль" onPress={() => {}} />
          <Divider />
          <Row icon="shield" label="Двухфакторная аутентификация" onPress={() => {}} />
          {bioAvailable && (
            <>
              <Divider />
              <View style={st.row}>
                <View style={[st.rowIcon, { backgroundColor: `${c.ACCENT}12` }]}>
                  <Feather name="cpu" size={16} color={c.ACCENT} />
                </View>
                <View style={st.rowBody}>
                  <Text style={[st.rowLabel, { color: c.INK }]}>Биометрическая блокировка</Text>
                  <Text style={[st.rowSub, { color: c.INK_SOFT }]}>Требует отпечаток при открытии</Text>
                </View>
                <Switch
                  value={bioLock}
                  onValueChange={toggleBioLock}
                  trackColor={{ false: c.LINE, true: `${c.ACCENT}60` }}
                  thumbColor={bioLock ? c.ACCENT : c.INK_SOFT}
                />
              </View>
            </>
          )}
          <Divider />
          <Row icon="log-out" label="Выйти из аккаунта" onPress={confirmLogout} danger />
        </Card>

        {/* Поддержка */}
        <SectionHeader title="Поддержка" />
        <Card>
          <Row icon="message-circle" label="Обратная связь" sub="Баг, идея или вопрос команде" onPress={() => setShowFeedback(true)} />
        </Card>

        <Text style={[st.version, { color: c.INK_SOFT }]}>xalle · v1.0.0</Text>
      </ScrollView>

      <FeedbackModal visible={showFeedback} onClose={() => setShowFeedback(false)} />
    </View>
  );
}

const st = StyleSheet.create({
  root:             { flex: 1 },
  header:           { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn:          { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  headerTitle:      { fontSize: 16, fontWeight: "700" },

  heroCard:         { flexDirection: "row", alignItems: "center", gap: 16, margin: 16, borderRadius: 18, padding: 18, shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 3 }, elevation: 3 },
  avatarWrap:       { position: "relative" },
  avatarOverlay:    { position: "absolute", bottom: 0, right: 0, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 2 },
  heroInfo:         { flex: 1 },
  heroName:         { fontSize: 18, fontWeight: "800" },
  heroHandle:       { fontSize: 13.5, marginTop: 2 },
  heroJoined:       { fontSize: 12, marginTop: 4 },
  deleteAvaBtn:     { marginTop: 6 },
  deleteAvaBtnText: { fontSize: 12, color: "#e05a5a" },

  sectionTitle:     { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8, paddingHorizontal: 20, paddingBottom: 8, paddingTop: 20 },
  card:             { marginHorizontal: 16, borderRadius: 16, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 1 },
  divider:          { height: StyleSheet.hairlineWidth, marginLeft: 56 },

  row:              { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 13, gap: 12 },
  iconWrap:         { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  iconWrapDanger:   { backgroundColor: "#e05a5a18" },
  rowBody:          { flex: 1 },
  rowLabel:         { fontSize: 15, fontWeight: "500" },
  rowSub:           { fontSize: 12.5, marginTop: 1 },
  rowValue:         { fontSize: 13.5 },
  danger:           { color: "#e05a5a" },

  editBox:          { padding: 14, gap: 10 },
  editInput:        { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, borderWidth: StyleSheet.hairlineWidth },
  editActions:      { flexDirection: "row", gap: 10, justifyContent: "flex-end" },
  editCancel:       { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  editCancelText:   { fontWeight: "600" },
  editSave:         { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  editSaveText:     { color: "#fff", fontWeight: "700" },

  colorCard:        { padding: 16, gap: 12 },
  colorLabel:       { fontSize: 13 },
  colorRow:         { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 4 },
  colorDot:         { position: "relative", width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  colorDotInner:    { width: 28, height: 28, borderRadius: 14 },
  colorDotInnerActive: { transform: [{ scale: 1.15 }] },
  colorCheck:       { position: "absolute", bottom: 0, right: 0, width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  colorPreview:     { fontSize: 14, marginTop: 4 },

  gradCard:         { padding: 16, gap: 12 },
  gradDot:          { position: "relative", width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  gradDotInner:     { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  gradPreviewWrap:  { flexDirection: "row", alignItems: "center", marginTop: 4 },
  gradNamePill:     { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, alignSelf: "flex-start" },

  version:          { textAlign: "center", fontSize: 12, marginTop: 24 },
});
