import { useState, useRef, useCallback, useEffect } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
  Image, Alert, Animated, Keyboard,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import Avatar from "../components/Avatar.jsx";
import MarkdownText from "../components/MarkdownText.jsx";
import EmojiPicker from "../components/EmojiPicker.jsx";
import { api } from "../lib/api.js";
import { uploadAssets } from "../lib/upload.js";
import { haptic } from "../lib/haptics.js";
import { useAuthStore } from "../store/auth.js";
import { useTheme } from "../store/theme.js";
import { API_BASE } from "../config.js";

const SCOPES = [
  { key: "world",     label: "Все",      icon: "globe" },
  { key: "following", label: "Подписки", icon: "users" },
  { key: "whisper",   label: "Личное",   icon: "lock" },
];
const FORMAT_BTNS = [
  { label: "B",   before: "**", after: "**",    style: { fontWeight: "700" } },
  { label: "I",   before: "*",  after: "*",     style: { fontStyle: "italic" } },
  { label: "S",   before: "~~", after: "~~",    style: { textDecorationLine: "line-through" } },
  { label: "</>", before: "`",  after: "`",     style: { fontFamily: "Courier New", fontSize: 12 } },
  { label: "❝",   before: "\n> ", after: "",    style: {} },
  { label: "||",  before: "||", after: "||",    style: { color: "#8a7f78" } },
  { label: "H1",  before: "\n# ", after: "",    style: { fontSize: 11, fontWeight: "700" } },
];
const MAX_LEN = 4000;
const POLL_EXPIRE_OPTIONS = [
  { label: "Без срока", value: 0 },
  { label: "1 час",     value: 60 },
  { label: "1 день",    value: 1440 },
  { label: "3 дня",     value: 4320 },
  { label: "1 неделя",  value: 10080 },
];

export default function ComposeScreen({ navigation, route }) {
  const insets   = useSafeAreaInsets();
  const user     = useAuthStore(s => s.user);
  const c        = useTheme();
  const inputRef = useRef(null);

  // Pass replyTo or repostOf via route.params if needed
  const { repostOf } = route?.params || {};

  const [body,      setBody]      = useState(repostOf ? "" : "");
  const [scope,     setScope]     = useState("world");
  const [busy,      setBusy]      = useState(false);
  const [error,     setError]     = useState(null);
  const [selection, setSelection] = useState({ start: 0, end: 0 });
  const [preview,   setPreview]   = useState(false);

  // Images
  const [images,     setImages]     = useState([]);
  const [uploading,  setUploading]  = useState(false);

  // Poll
  const [showPoll,     setShowPoll]     = useState(false);
  const [pollQ,        setPollQ]        = useState("");
  const [pollOpts,     setPollOpts]     = useState(["", ""]);
  const [pollAnon,     setPollAnon]     = useState(false);
  const [pollMulti,    setPollMulti]    = useState(false);
  const [pollUnvote,   setPollUnvote]   = useState(true);
  const [pollExpire,   setPollExpire]   = useState(0);

  // Schedule
  const [showSchedule, setShowSchedule] = useState(false);
  const [schedDate,    setSchedDate]    = useState("");
  const [schedTime,    setSchedTime]    = useState("");

  // Emoji picker
  const [showEmoji, setShowEmoji] = useState(false);

  // Mention autocomplete
  const [mentionQuery, setMentionQuery] = useState(null); // null = off, string = current query
  const [mentionUsers, setMentionUsers] = useState([]);
  const mentionTimer = useRef(null);

  // Tabs animation
  const tabAnim = useRef(new Animated.Value(0)).current;

  // Load cloud draft on mount
  useEffect(() => {
    api("/draft").then(d => {
      if (d?.body && !body) setBody(d.body);
    }).catch(() => {});
  }, []);

  // Auto-save draft after 2s of no typing
  const draftTimer = useRef(null);
  const handleBodyChange = (v) => {
    setBody(v);
    setError(null);
    clearTimeout(draftTimer.current);
    if (v.trim()) {
      draftTimer.current = setTimeout(() => {
        api("/draft", { method: "PUT", body: { body: v } }).catch(() => {});
      }, 2000);
    } else {
      api("/draft", { method: "DELETE" }).catch(() => {});
    }

    // Mention autocomplete: detect @word at cursor
    const cur = selection.end;
    const before = v.slice(0, cur);
    const match = before.match(/@(\w*)$/);
    if (match) {
      const q = match[1];
      setMentionQuery(q);
      clearTimeout(mentionTimer.current);
      mentionTimer.current = setTimeout(async () => {
        try {
          const res = await api(`/users/search?q=${encodeURIComponent(q)}&limit=6`);
          setMentionUsers(Array.isArray(res) ? res : (res?.users || []));
        } catch { setMentionUsers([]); }
      }, 250);
    } else {
      setMentionQuery(null);
      setMentionUsers([]);
    }
  };

  const insertEmoji = useCallback((emoji) => {
    const { start, end } = selection;
    const newBody = body.slice(0, start) + emoji + body.slice(end);
    const newPos = start + emoji.length;
    setBody(newBody);
    setSelection({ start: newPos, end: newPos });
    haptic.light();
  }, [body, selection]);

  const insertMention = useCallback((handle) => {
    const cur = selection.end;
    const before = body.slice(0, cur);
    const replaced = before.replace(/@(\w*)$/, `@${handle} `);
    const newBody = replaced + body.slice(cur);
    const newPos = replaced.length;
    setBody(newBody);
    setSelection({ start: newPos, end: newPos });
    setMentionQuery(null);
    setMentionUsers([]);
    haptic.select();
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [body, selection]);

  const canPost = (body.trim().length > 0 || images.length > 0) && body.length <= MAX_LEN;
  const remaining = MAX_LEN - body.length;
  const nearLimit = remaining < 200;
  const atLimit   = remaining < 0;

  const pickImages = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Нет доступа", "Разреши доступ к медиатеке в настройках."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 4 - images.length,
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.length) return;
    setUploading(true);
    haptic.light();
    try {
      const urls = await uploadAssets(result.assets);
      setImages(prev => [...prev, ...urls].slice(0, 4));
      haptic.success();
    } catch (e) {
      Alert.alert("Ошибка загрузки", e.message);
    }
    setUploading(false);
  };

  const pickVideo = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") { Alert.alert("Нет доступа", "Разреши доступ к медиатеке в настройках."); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["videos"],
      allowsMultipleSelection: false,
      videoMaxDuration: 120,
    });
    if (result.canceled || !result.assets?.length) return;
    setUploading(true);
    haptic.light();
    try {
      const urls = await uploadAssets(result.assets);
      setImages(prev => [...prev, ...urls].slice(0, 4));
      haptic.success();
    } catch (e) {
      Alert.alert("Ошибка загрузки", e.message);
    }
    setUploading(false);
  };

  const submit = async () => {
    if ((!body.trim() && images.length === 0) || busy) return;
    setBusy(true);
    setError(null);
    haptic.medium();
    try {
      const whisper = scope === "whisper";
      const payload = {
        body: body.trim(),
        whisper,
        images,
      };

      // Add poll
      if (showPoll && pollQ.trim() && pollOpts.filter(o => o.trim()).length >= 2) {
        payload.poll = {
          question: pollQ.trim(),
          options: pollOpts.filter(o => o.trim()),
          anonymous: pollAnon,
          multiChoice: pollMulti,
          allowUnvote: pollUnvote,
          expiresIn: pollExpire,
        };
      }

      if (showSchedule && schedDate && schedTime) {
        // Schedule the post
        const scheduleFor = new Date(`${schedDate}T${schedTime}`).toISOString();
        await api("/posts/schedule", { method: "POST", body: { ...payload, scheduleFor } });
        haptic.success();
        Alert.alert("Запланировано", `Пост выйдет ${schedDate} в ${schedTime}.`);
      } else {
        await api("/posts", { method: "POST", body: payload });
        haptic.success();
      }

      // Clear draft
      api("/draft", { method: "DELETE" }).catch(() => {});
      navigation.goBack();
    } catch (e) {
      setError(e.message || "Ошибка публикации");
      haptic.error();
      setBusy(false);
    }
  };

  const applyFormat = useCallback((before, after) => {
    const { start, end } = selection;
    const sel = body.slice(start, end);
    let newBody, newStart, newEnd;
    if (start === end) {
      newBody  = body.slice(0, start) + before + after + body.slice(start);
      newStart = start + before.length;
      newEnd   = newStart;
    } else {
      const already =
        body.slice(start - before.length, start) === before &&
        (after ? body.slice(end, end + after.length) === after : true);
      if (already) {
        newBody  = body.slice(0, start - before.length) + sel + body.slice(end + after.length);
        newStart = start - before.length;
        newEnd   = newStart + sel.length;
      } else {
        newBody  = body.slice(0, start) + before + sel + after + body.slice(end);
        newStart = start + before.length;
        newEnd   = end + before.length;
      }
    }
    setBody(newBody);
    setSelection({ start: newStart, end: newEnd });
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [body, selection]);

  const switchTab = (toPreview) => {
    setPreview(toPreview);
    Animated.spring(tabAnim, { toValue: toPreview ? 1 : 0, useNativeDriver: false, tension: 80, friction: 11 }).start();
    if (!toPreview) setTimeout(() => inputRef.current?.focus(), 100);
  };

  const indicatorLeft = tabAnim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "50%"] });

  const scope_ = SCOPES.find(s => s.key === scope);

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top, backgroundColor: c.SURFACE }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Top bar */}
      <View style={[styles.topBar, { borderBottomColor: c.LINE }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn} activeOpacity={0.7}>
          <Feather name="x" size={20} color={c.INK_SOFT} />
        </TouchableOpacity>

        {/* Write / Preview tabs */}
        <View style={styles.tabs}>
          <View style={[styles.tabsInner, { backgroundColor: c.WARM }]}>
            <Animated.View style={[styles.tabIndicator, { left: indicatorLeft, backgroundColor: c.SURFACE }]} />
            <TouchableOpacity style={styles.tab} onPress={() => switchTab(false)} activeOpacity={0.75}>
              <Text style={[styles.tabText, { color: c.INK_SOFT }, !preview && { color: c.INK }]}>Написать</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.tab} onPress={() => switchTab(true)} activeOpacity={0.75}>
              <Text style={[styles.tabText, { color: c.INK_SOFT }, preview && { color: c.INK }]}>Просмотр</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.postBtn, { backgroundColor: c.ACCENT }, (!canPost || atLimit) && styles.postBtnOff]}
          onPress={submit}
          disabled={!canPost || busy || atLimit}
          activeOpacity={0.8}
        >
          {busy
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.postBtnText}>{showSchedule ? "Запланировать" : "Опубликовать"}</Text>
          }
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} keyboardShouldPersistTaps="handled" keyboardDismissMode="none">
        {/* Author row */}
        <View style={styles.authorRow}>
          <Avatar url={user?.avatar_url} name={user?.name} size={42} />
          <View style={styles.authorInfo}>
            <Text style={[styles.authorName, { color: c.INK }]}>{user?.name || "Вы"}</Text>
            <Text style={[styles.authorHandle, { color: c.INK_SOFT }]}>@{user?.handle}</Text>
          </View>
          <TouchableOpacity style={[styles.scopeBadge, { backgroundColor: `${c.ACCENT}12`, borderColor: `${c.ACCENT}22` }]} onPress={() => {
            const idx = SCOPES.findIndex(s => s.key === scope);
            setScope(SCOPES[(idx + 1) % SCOPES.length].key);
            haptic.select();
          }}>
            <Feather name={scope_?.icon || "globe"} size={12} color={c.ACCENT} />
            <Text style={[styles.scopeBadgeText, { color: c.ACCENT }]}>{scope_?.label}</Text>
          </TouchableOpacity>
        </View>

        {/* Edit mode */}
        {!preview && (
          <TextInput
            ref={inputRef}
            style={[styles.input, { color: c.INK }]}
            placeholder="Что у тебя нового?"
            placeholderTextColor={c.INK_SOFT}
            value={body}
            onChangeText={handleBodyChange}
            onSelectionChange={e => setSelection(e.nativeEvent.selection)}
            selection={selection}
            multiline
            autoFocus
            maxLength={MAX_LEN + 50}
            textAlignVertical="top"
          />
        )}

        {/* Preview mode */}
        {preview && (
          <View style={styles.previewWrap}>
            {body.trim() ? (
              <MarkdownText style={[styles.previewText, { color: c.INK }]}>{body}</MarkdownText>
            ) : (
              <View style={styles.previewEmpty}>
                <Feather name="eye-off" size={28} color={c.LINE} />
                <Text style={[styles.previewEmptyText, { color: c.INK_SOFT }]}>Нечего показывать</Text>
              </View>
            )}
          </View>
        )}

        {/* Images preview */}
        {images.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imgRow}>
            {images.map((url, i) => (
              <View key={i} style={styles.imgThumbWrap}>
                <Image source={{ uri: url.startsWith("http") ? url : `${API_BASE}${url}` }} style={styles.imgThumb} resizeMode="cover" />
                <TouchableOpacity style={styles.imgRemove} onPress={() => setImages(prev => prev.filter((_, j) => j !== i))}>
                  <Feather name="x" size={12} color="#fff" />
                </TouchableOpacity>
              </View>
            ))}
            {uploading && (
              <View style={[styles.imgThumb, styles.imgLoading, { backgroundColor: c.WARM }]}>
                <ActivityIndicator color={c.ACCENT} />
              </View>
            )}
          </ScrollView>
        )}

        {/* Poll builder */}
        {showPoll && (
          <View style={[styles.pollBox, { backgroundColor: c.WARM, borderColor: c.LINE }]}>
            <Text style={[styles.pollTitle, { color: c.INK }]}>📊 Опрос</Text>
            <TextInput
              style={[styles.pollQ, { backgroundColor: c.SURFACE, color: c.INK, borderColor: c.LINE }]}
              placeholder="Вопрос опроса..."
              placeholderTextColor={c.INK_SOFT}
              value={pollQ}
              onChangeText={setPollQ}
              maxLength={200}
            />
            {pollOpts.map((opt, i) => (
              <View key={i} style={styles.pollOptRow}>
                <TextInput
                  style={[styles.pollOptInput, { backgroundColor: c.SURFACE, color: c.INK, borderColor: c.LINE }]}
                  placeholder={`Вариант ${i + 1}`}
                  placeholderTextColor={c.INK_SOFT}
                  value={opt}
                  onChangeText={v => setPollOpts(prev => prev.map((o, j) => j === i ? v : o))}
                  maxLength={100}
                />
                {pollOpts.length > 2 && (
                  <TouchableOpacity onPress={() => setPollOpts(prev => prev.filter((_, j) => j !== i))} style={[styles.pollOptDel, { backgroundColor: c.SURFACE }]}>
                    <Feather name="x" size={14} color={c.INK_SOFT} />
                  </TouchableOpacity>
                )}
              </View>
            ))}
            {pollOpts.length < 4 && (
              <TouchableOpacity style={styles.pollAddOpt} onPress={() => setPollOpts(prev => [...prev, ""])}>
                <Feather name="plus" size={14} color={c.ACCENT} />
                <Text style={[styles.pollAddOptText, { color: c.ACCENT }]}>Добавить вариант</Text>
              </TouchableOpacity>
            )}
            <View style={styles.pollToggles}>
              <TouchableOpacity style={styles.pollToggle} onPress={() => setPollAnon(v => !v)}>
                <View style={[styles.pollCheck, { borderColor: c.LINE }, pollAnon && { backgroundColor: c.ACCENT, borderColor: c.ACCENT }]}>
                  {pollAnon && <Feather name="check" size={10} color="#fff" />}
                </View>
                <Text style={[styles.pollToggleText, { color: c.INK_SOFT }]}>Анонимные голоса</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pollToggle} onPress={() => setPollMulti(v => !v)}>
                <View style={[styles.pollCheck, { borderColor: c.LINE }, pollMulti && { backgroundColor: c.ACCENT, borderColor: c.ACCENT }]}>
                  {pollMulti && <Feather name="check" size={10} color="#fff" />}
                </View>
                <Text style={[styles.pollToggleText, { color: c.INK_SOFT }]}>Несколько вариантов</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.pollToggle} onPress={() => setPollUnvote(v => !v)}>
                <View style={[styles.pollCheck, { borderColor: c.LINE }, pollUnvote && { backgroundColor: c.ACCENT, borderColor: c.ACCENT }]}>
                  {pollUnvote && <Feather name="check" size={10} color="#fff" />}
                </View>
                <Text style={[styles.pollToggleText, { color: c.INK_SOFT }]}>Отменить голос</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
              <View style={{ flexDirection: "row", gap: 6 }}>
                {POLL_EXPIRE_OPTIONS.map(o => (
                  <TouchableOpacity
                    key={o.value}
                    style={[styles.expireChip, { backgroundColor: c.SURFACE, borderColor: c.LINE }, pollExpire === o.value && { backgroundColor: `${c.ACCENT}14`, borderColor: c.ACCENT }]}
                    onPress={() => setPollExpire(o.value)}
                  >
                    <Text style={[styles.expireText, { color: c.INK_SOFT }, pollExpire === o.value && { color: c.ACCENT, fontWeight: "600" }]}>{o.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          </View>
        )}

        {/* Schedule picker */}
        {showSchedule && (
          <View style={[styles.schedBox, { backgroundColor: c.WARM, borderColor: c.LINE }]}>
            <Text style={[styles.schedTitle, { color: c.INK }]}>⏰ Запланировать публикацию</Text>
            <View style={styles.schedRow}>
              <TextInput
                style={[styles.schedInput, { backgroundColor: c.SURFACE, color: c.INK, borderColor: c.LINE }]}
                placeholder="ГГГГ-ММ-ДД"
                placeholderTextColor={c.INK_SOFT}
                value={schedDate}
                onChangeText={setSchedDate}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />
              <TextInput
                style={[styles.schedInput, { backgroundColor: c.SURFACE, color: c.INK, borderColor: c.LINE }]}
                placeholder="ЧЧ:ММ"
                placeholderTextColor={c.INK_SOFT}
                value={schedTime}
                onChangeText={setSchedTime}
                keyboardType="numbers-and-punctuation"
                maxLength={5}
              />
            </View>
          </View>
        )}

        {error && (
          <View style={styles.errorRow}>
            <Feather name="alert-circle" size={14} color="#e05a5a" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Bottom toolbar */}
      {!preview && (
        <View style={[styles.toolbar, { paddingBottom: insets.bottom + 6, borderTopColor: c.LINE, backgroundColor: c.SURFACE }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.fmtScroll} contentContainerStyle={styles.fmtRow}>
            {FORMAT_BTNS.map(btn => (
              <TouchableOpacity key={btn.label} style={[styles.fmtBtn, { backgroundColor: c.WARM }]} onPress={() => applyFormat(btn.before, btn.after)} activeOpacity={0.65}>
                <Text style={[styles.fmtLabel, { color: c.INK }, btn.style]}>{btn.label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <View style={styles.toolbarBottom}>
            <View style={styles.toolActions}>
              {/* Add images */}
              <TouchableOpacity
                style={[styles.toolBtn, { backgroundColor: c.WARM }, images.length >= 4 && styles.toolBtnOff]}
                onPress={pickImages}
                disabled={images.length >= 4 || uploading}
                activeOpacity={0.7}
              >
                {uploading
                  ? <ActivityIndicator size="small" color={c.ACCENT} />
                  : <Feather name="image" size={18} color={images.length >= 4 ? c.INK_SOFT : c.ACCENT} />
                }
              </TouchableOpacity>

              {/* Add video */}
              <TouchableOpacity
                style={[styles.toolBtn, { backgroundColor: c.WARM }, images.length >= 4 && styles.toolBtnOff]}
                onPress={pickVideo}
                disabled={images.length >= 4 || uploading}
                activeOpacity={0.7}
              >
                <Feather name="video" size={18} color={images.length >= 4 ? c.INK_SOFT : c.ACCENT} />
              </TouchableOpacity>

              {/* Poll toggle */}
              <TouchableOpacity
                style={[styles.toolBtn, { backgroundColor: c.WARM }, showPoll && { backgroundColor: `${c.ACCENT}14` }]}
                onPress={() => { setShowPoll(v => !v); haptic.light(); }}
                activeOpacity={0.7}
              >
                <Feather name="bar-chart-2" size={18} color={showPoll ? c.ACCENT : c.INK_SOFT} />
              </TouchableOpacity>

              {/* Schedule toggle */}
              <TouchableOpacity
                style={[styles.toolBtn, { backgroundColor: c.WARM }, showSchedule && { backgroundColor: `${c.ACCENT}14` }]}
                onPress={() => { setShowSchedule(v => !v); haptic.light(); }}
                activeOpacity={0.7}
              >
                <Feather name="clock" size={18} color={showSchedule ? c.ACCENT : c.INK_SOFT} />
              </TouchableOpacity>

              {/* Emoji picker toggle */}
              <TouchableOpacity
                style={[styles.toolBtn, { backgroundColor: c.WARM }, showEmoji && { backgroundColor: `${c.ACCENT}14` }]}
                onPress={() => {
                  const next = !showEmoji;
                  setShowEmoji(next);
                  if (next) Keyboard.dismiss();
                  else setTimeout(() => inputRef.current?.focus(), 100);
                  haptic.light();
                }}
                activeOpacity={0.7}
              >
                <Text style={{ fontSize: 16, lineHeight: 20 }}>😊</Text>
              </TouchableOpacity>
            </View>

            {body.length > 0 && (
              <Text style={[
                styles.counter, { color: c.INK_SOFT },
                nearLimit && !atLimit && styles.counterWarn,
                atLimit && styles.counterOver,
              ]}>
                {remaining}
              </Text>
            )}
          </View>
        </View>
      )}

      {preview && <View style={{ height: insets.bottom + 16 }} />}

      {/* Mention autocomplete dropdown */}
      {mentionQuery !== null && mentionUsers.length > 0 && !preview && (
        <View style={[styles.mentionList, { backgroundColor: c.SURFACE, borderTopColor: c.LINE }]}>
          {mentionUsers.map(u => (
            <TouchableOpacity
              key={u.id || u.handle}
              style={[styles.mentionRow, { borderBottomColor: c.LINE }]}
              onPress={() => insertMention(u.handle)}
              activeOpacity={0.75}
            >
              <Avatar url={u.avatar_url} name={u.name} size={30} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.mentionName, { color: c.INK }]} numberOfLines={1}>{u.name}</Text>
                <Text style={[styles.mentionHandle, { color: c.INK_SOFT }]} numberOfLines={1}>@{u.handle}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Emoji picker panel */}
      {showEmoji && !preview && (
        <EmojiPicker
          onSelect={(e) => { insertEmoji(e); }}
          onClose={() => { setShowEmoji(false); setTimeout(() => inputRef.current?.focus(), 100); }}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root:         { flex: 1 },

  topBar:       { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  cancelBtn:    { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  tabs:         { flex: 1, alignItems: "center" },
  tabsInner:    { flexDirection: "row", position: "relative", borderRadius: 20, padding: 3, width: 180 },
  tabIndicator: { position: "absolute", top: 3, bottom: 3, width: "50%", borderRadius: 17, shadowColor: "#000", shadowOpacity: 0.07, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2 },
  tab:          { flex: 1, alignItems: "center", paddingVertical: 5, zIndex: 1 },
  tabText:      { fontSize: 13, fontWeight: "600" },

  postBtn:      { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  postBtnOff:   { opacity: 0.35 },
  postBtnText:  { color: "#fff", fontWeight: "700", fontSize: 12.5 },

  body:         { flex: 1, paddingHorizontal: 15 },
  authorRow:    { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 14 },
  authorInfo:   { flex: 1 },
  authorName:   { fontSize: 14.5, fontWeight: "700" },
  authorHandle: { fontSize: 12.5, marginTop: 1 },
  scopeBadge:   { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4, borderWidth: 1 },
  scopeBadgeText: { fontSize: 12, fontWeight: "600" },

  input:        { fontSize: 16, lineHeight: 24, minHeight: 140 },

  previewWrap:  { paddingVertical: 4 },
  previewText:  { fontSize: 16, lineHeight: 24 },
  previewEmpty: { alignItems: "center", paddingTop: 60, gap: 12 },
  previewEmptyText: { fontSize: 14 },

  imgRow:       { marginTop: 8, marginBottom: 4 },
  imgThumbWrap: { position: "relative", marginRight: 8 },
  imgThumb:     { width: 80, height: 80, borderRadius: 10 },
  imgLoading:   { alignItems: "center", justifyContent: "center" },
  imgRemove:    { position: "absolute", top: -6, right: -6, width: 20, height: 20, borderRadius: 10, backgroundColor: "#e05a5a", alignItems: "center", justifyContent: "center" },

  pollBox:      { borderRadius: 14, padding: 14, marginTop: 8, borderWidth: 1 },
  pollTitle:    { fontSize: 14, fontWeight: "700", marginBottom: 10 },
  pollQ:        { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, marginBottom: 8, borderWidth: 1 },
  pollOptRow:   { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  pollOptInput: { flex: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, borderWidth: 1 },
  pollOptDel:   { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  pollAddOpt:   { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6 },
  pollAddOptText: { fontSize: 13, fontWeight: "600" },
  pollToggles:  { marginTop: 8, gap: 6 },
  pollToggle:   { flexDirection: "row", alignItems: "center", gap: 8 },
  pollCheck:    { width: 18, height: 18, borderRadius: 4, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  pollToggleText: { fontSize: 13 },
  expireChip:   { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  expireText:   { fontSize: 12 },

  schedBox:     { borderRadius: 14, padding: 14, marginTop: 8, borderWidth: 1 },
  schedTitle:   { fontSize: 14, fontWeight: "700", marginBottom: 10 },
  schedRow:     { flexDirection: "row", gap: 8 },
  schedInput:   { flex: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, borderWidth: 1 },

  errorRow:     { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  errorText:    { fontSize: 13, color: "#e05a5a" },

  toolbar:      { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, gap: 8 },
  fmtScroll:    { maxHeight: 40 },
  fmtRow:       { flexDirection: "row", gap: 4, paddingHorizontal: 12 },
  fmtBtn:       { minWidth: 34, height: 34, paddingHorizontal: 8, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  fmtLabel:     { fontSize: 13.5, fontWeight: "700" },

  toolbarBottom:{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 },
  toolActions:  { flexDirection: "row", gap: 4 },
  toolBtn:      { width: 36, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  toolBtnOff:   { opacity: 0.35 },
  counter:      { fontSize: 13.5, fontWeight: "700" },
  counterWarn:  { color: "#d99a2b" },
  counterOver:  { color: "#e05a5a" },

  mentionList:   { position: "absolute", bottom: "100%", left: 0, right: 0, borderTopWidth: 1, maxHeight: 220, zIndex: 99 },
  mentionRow:    { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth },
  mentionName:   { fontSize: 14, fontWeight: "700" },
  mentionHandle: { fontSize: 12 },
});
