import { useState, useEffect, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import Avatar from "./Avatar.jsx";
import { api } from "../lib/api.js";
import { haptic } from "../lib/haptics.js";
import { timeAgo } from "../lib/format.js";
import { useAuthStore } from "../store/auth.js";
import { useTheme } from "../store/theme.js";

const AUTHOR_COLORS = [
  "#a78bfa","#60a5fa","#34d399","#fb923c",
  "#f472b6","#38bdf8","#a3e635","#fbbf24",
];
function authorColor(idx) { return AUTHOR_COLORS[idx % AUTHOR_COLORS.length]; }

function Block({ block, idx, me, postId, onRefresh }) {
  const c        = useTheme();
  const isOwner  = me?.handle === block.handle || me?.id === block.user_id;
  const color    = authorColor(idx);

  const [editing, setEditing]   = useState(false);
  const [editText, setEditText] = useState(block.body);
  const [busy, setBusy]         = useState(false);

  const saveEdit = async () => {
    const t = editText.trim();
    if (!t || t === block.body) { setEditing(false); return; }
    setBusy(true);
    try {
      await api(`/posts/${postId}/blocks/${block.id}`, { method: "PATCH", body: { body: t } });
      haptic.success();
      onRefresh();
      setEditing(false);
    } catch (e) {
      Alert.alert("Ошибка", e.message || "Не удалось сохранить");
    } finally { setBusy(false); }
  };

  const deleteBlock = () => {
    Alert.alert("Удалить блок?", "Это действие нельзя отменить.", [
      { text: "Отмена", style: "cancel" },
      { text: "Удалить", style: "destructive", onPress: async () => {
        setBusy(true);
        try {
          await api(`/posts/${postId}/blocks/${block.id}`, { method: "DELETE" });
          haptic.success();
          onRefresh();
        } catch (e) {
          Alert.alert("Ошибка", e.message || "Не удалось удалить");
        } finally { setBusy(false); }
      }},
    ]);
  };

  return (
    <View style={[st.block, { borderLeftColor: color, backgroundColor: c.WARM }]}>
      {/* Author row */}
      <View style={st.blockHead}>
        <Avatar url={block.avatar_url} name={block.name} size={24} />
        <Text style={[st.blockAuthor, { color }]}>{block.name}</Text>
        <Text style={[st.blockTime, { color: c.INK_SOFT }]}>{timeAgo(block.created_at)}</Text>
        {isOwner && !editing && (
          <View style={st.blockActions}>
            <TouchableOpacity onPress={() => { setEditText(block.body); setEditing(true); }} style={st.blockBtn} disabled={busy}>
              <Feather name="edit-2" size={13} color={c.INK_SOFT} />
            </TouchableOpacity>
            <TouchableOpacity onPress={deleteBlock} style={st.blockBtn} disabled={busy}>
              <Feather name="trash-2" size={13} color="#e05a5a" />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Body / edit */}
      {editing ? (
        <View style={st.blockEditWrap}>
          <TextInput
            style={[st.blockEditInput, { backgroundColor: c.SURFACE, color: c.INK, borderColor: `${c.ACCENT}40` }]}
            value={editText}
            onChangeText={setEditText}
            multiline
            autoFocus
            maxLength={10000}
          />
          <View style={st.blockEditActions}>
            <TouchableOpacity onPress={() => setEditing(false)} disabled={busy} style={[st.blockEditBtn, { backgroundColor: c.LINE }]}>
              <Text style={[st.blockEditBtnText, { color: c.INK_SOFT }]}>Отмена</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={saveEdit} disabled={busy} style={[st.blockEditBtn, { backgroundColor: c.ACCENT }]}>
              {busy
                ? <ActivityIndicator size="small" color="#fff" />
                : <Text style={[st.blockEditBtnText, { color: "#fff" }]}>Сохранить</Text>
              }
            </TouchableOpacity>
          </View>
        </View>
      ) : (
        <Text style={[st.blockBody, { color: c.INK }]}>{block.body}</Text>
      )}

      {block.prev_body && (
        <View style={[st.editedBadge, { backgroundColor: `${c.INK_SOFT}12` }]}>
          <Feather name="edit" size={10} color={c.INK_SOFT} />
          <Text style={[st.editedText, { color: c.INK_SOFT }]}>изменено</Text>
        </View>
      )}
    </View>
  );
}

export default function CollabPanel({ post, onRefresh }) {
  const c       = useTheme();
  const me      = useAuthStore(s => s.user);
  const isOwner = me?.id === post.user_id;
  const isMod   = me?.role === "moderator";

  const [blocks, setBlocks]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [text, setText]         = useState("");
  const [adding, setAdding]     = useState(false);
  const [toggling, setToggling] = useState(false);
  const [isOpen, setIsOpen]     = useState(post.collab_open !== false);

  const load = useCallback(async () => {
    try {
      const data = await api(`/v2/posts/${post.id}/blocks`);
      setBlocks(Array.isArray(data) ? data : []);
    } catch {} finally { setLoading(false); }
  }, [post.id]);

  useEffect(() => { load(); }, []);

  const addBlock = async () => {
    const t = text.trim();
    if (!t) return;
    setAdding(true);
    try {
      await api(`/posts/${post.id}/block`, { method: "POST", body: { body: t } });
      setText("");
      haptic.success();
      load();
      onRefresh?.();
    } catch (e) {
      Alert.alert("Ошибка", e.message || "Не удалось добавить блок");
    } finally { setAdding(false); }
  };

  const toggleOpen = async () => {
    setToggling(true);
    try {
      await api(`/posts/${post.id}/collab-mode`, { method: "PATCH", body: { open: !isOpen } });
      setIsOpen(v => !v);
      haptic.light();
    } catch (e) {
      Alert.alert("Ошибка", e.message || "Не удалось изменить режим");
    } finally { setToggling(false); }
  };

  const canAdd = isOpen && me;
  const alreadyAdded = blocks.some(b => b.user_id === me?.id);

  return (
    <View style={[st.root, { backgroundColor: c.SURFACE, borderColor: c.LINE }]}>
      {/* Header */}
      <View style={st.header}>
        <View style={st.headerLeft}>
          <Feather name="users" size={15} color={c.ACCENT} />
          <Text style={[st.headerTitle, { color: c.INK }]}>Сборный пост</Text>
          <View style={[st.statusBadge, { backgroundColor: isOpen ? "#34d39918" : "#e05a5a18" }]}>
            <View style={[st.statusDot, { backgroundColor: isOpen ? "#34d399" : "#e05a5a" }]} />
            <Text style={[st.statusText, { color: isOpen ? "#34d399" : "#e05a5a" }]}>
              {isOpen ? "Открыт" : "Закрыт"}
            </Text>
          </View>
        </View>
        {(isOwner || isMod) && (
          <TouchableOpacity
            style={[st.toggleBtn, { backgroundColor: `${c.ACCENT}12` }]}
            onPress={toggleOpen}
            disabled={toggling}
            activeOpacity={0.7}
          >
            {toggling
              ? <ActivityIndicator size="small" color={c.ACCENT} />
              : <Feather name={isOpen ? "lock" : "unlock"} size={14} color={c.ACCENT} />
            }
          </TouchableOpacity>
        )}
      </View>

      {/* Blocks list */}
      {loading ? (
        <View style={st.loading}><ActivityIndicator color={c.ACCENT} size="small" /></View>
      ) : blocks.length === 0 ? (
        <Text style={[st.empty, { color: c.INK_SOFT }]}>Ещё никто не добавил блок</Text>
      ) : (
        <View style={st.blocks}>
          {blocks.map((block, idx) => (
            <Block
              key={block.id}
              block={block}
              idx={idx}
              me={me}
              postId={post.id}
              onRefresh={load}
            />
          ))}
        </View>
      )}

      {/* Add block input */}
      {canAdd && !alreadyAdded && (
        <View style={[st.addWrap, { borderTopColor: c.LINE }]}>
          <TextInput
            style={[st.addInput, { backgroundColor: c.WARM, color: c.INK, borderColor: `${c.ACCENT}30` }]}
            placeholder="Добавить свой блок..."
            placeholderTextColor={c.INK_SOFT}
            value={text}
            onChangeText={setText}
            multiline
            maxLength={10000}
          />
          <TouchableOpacity
            style={[st.addBtn, { backgroundColor: text.trim() ? c.ACCENT : `${c.ACCENT}30` }]}
            onPress={addBlock}
            disabled={adding || !text.trim()}
            activeOpacity={0.8}
          >
            {adding
              ? <ActivityIndicator size="small" color="#fff" />
              : <Feather name="plus" size={18} color="#fff" />
            }
          </TouchableOpacity>
        </View>
      )}

      {canAdd && alreadyAdded && (
        <View style={[st.alreadyWrap, { borderTopColor: c.LINE }]}>
          <Feather name="check-circle" size={14} color="#34d399" />
          <Text style={[st.alreadyText, { color: c.INK_SOFT }]}>Вы уже добавили блок</Text>
        </View>
      )}

      {!isOpen && !isOwner && (
        <View style={[st.alreadyWrap, { borderTopColor: c.LINE }]}>
          <Feather name="lock" size={14} color={c.INK_SOFT} />
          <Text style={[st.alreadyText, { color: c.INK_SOFT }]}>Пост закрыт для новых участников</Text>
        </View>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root:           { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, marginHorizontal: 16, marginBottom: 12, overflow: "hidden" },
  header:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, paddingVertical: 12 },
  headerLeft:     { flexDirection: "row", alignItems: "center", gap: 6 },
  headerTitle:    { fontSize: 14, fontWeight: "700" },
  statusBadge:    { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  statusDot:      { width: 6, height: 6, borderRadius: 3 },
  statusText:     { fontSize: 11, fontWeight: "700" },
  toggleBtn:      { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  loading:        { paddingVertical: 16, alignItems: "center" },
  empty:          { fontSize: 13.5, textAlign: "center", paddingVertical: 16, paddingHorizontal: 16, fontStyle: "italic" },
  blocks:         { gap: 0 },

  block:          { borderLeftWidth: 3, marginHorizontal: 12, marginBottom: 8, borderRadius: 10, padding: 10 },
  blockHead:      { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  blockAuthor:    { fontSize: 13, fontWeight: "700", flex: 1 },
  blockTime:      { fontSize: 11 },
  blockActions:   { flexDirection: "row", gap: 4 },
  blockBtn:       { padding: 4 },
  blockBody:      { fontSize: 14.5, lineHeight: 21 },
  blockEditWrap:  { gap: 8 },
  blockEditInput: { borderRadius: 8, padding: 10, fontSize: 14, minHeight: 80, borderWidth: 1, textAlignVertical: "top" },
  blockEditActions: { flexDirection: "row", gap: 8 },
  blockEditBtn:   { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8 },
  blockEditBtnText: { fontSize: 13.5, fontWeight: "700" },
  editedBadge:    { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6, alignSelf: "flex-start", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  editedText:     { fontSize: 10 },

  addWrap:        { flexDirection: "row", gap: 10, alignItems: "flex-end", padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
  addInput:       { flex: 1, borderRadius: 12, padding: 10, fontSize: 14, maxHeight: 120, borderWidth: 1, textAlignVertical: "top" },
  addBtn:         { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  alreadyWrap:    { flexDirection: "row", alignItems: "center", gap: 6, padding: 12, borderTopWidth: StyleSheet.hairlineWidth },
  alreadyText:    { fontSize: 13, fontStyle: "italic" },
});
