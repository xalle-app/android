import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, RefreshControl,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { api } from "../lib/api.js";
import { useTheme } from "../store/theme.js";

// ── Constants ──────────────────────────────────────────────────
const TYPES = [
  { value: "task",     label: "Задача",      icon: "✓",  color: "#5fa8d3" },
  { value: "reminder", label: "Напоминание", icon: "🔔", color: "#d99a2b" },
  { value: "event",    label: "Событие",     icon: "📅", color: "#7a7ec8" },
];
const PRIOS = [
  { value: "low",    label: "Низкий",   color: "#5fa8a8" },
  { value: "normal", label: "Обычный",  color: "#888" },
  { value: "high",   label: "Высокий",  color: "#d65f7a" },
];
const CATS = ["Работа", "Учёба", "Личное", "Здоровье", "Финансы", "Хобби"];

const TYPE_MAP = Object.fromEntries(TYPES.map(t => [t.value, t]));
const EMPTY_FORM = { title: "", body: "", type: "task", priority: "normal", dueAt: "", category: "" };

// ── Helpers ────────────────────────────────────────────────────
function fmtDue(dtStr) {
  if (!dtStr) return null;
  const d = new Date(dtStr.replace(" ", "T"));
  const now = new Date();
  const diff = d - now;
  if (diff < 0) return { text: "Просрочено", warn: true };
  const dayMs = 86400000;
  if (diff < dayMs) {
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    return { text: h > 0 ? `${h}ч ${m}м` : `${m} мин`, urgent: diff < 3600000 };
  }
  const days = Math.floor(diff / dayMs);
  if (days === 1) return { text: "Завтра" };
  if (days <= 7) return { text: `через ${days} дн.` };
  return { text: d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) };
}

// ── Task Card ──────────────────────────────────────────────────
function TaskCard({ task, onToggleDone, onEdit, onDelete, isPending, onAccept, onDecline }) {
  const c = useTheme();
  const typeInfo = TYPE_MAP[task.type] || TYPES[0];
  const prio = PRIOS.find(p => p.value === task.priority) || PRIOS[1];
  const due = fmtDue(task.due_at);
  const isDone = task.status === "done";
  const isHighPrio = task.priority === "high";

  if (isPending) {
    return (
      <View style={[st.card, { backgroundColor: c.SURFACE, borderColor: c.ACCENT + "55" }]}>
        <View style={[st.cardLeft, { borderRightColor: c.LINE }]}>
          <Text style={st.typeIcon}>{typeInfo.icon}</Text>
        </View>
        <View style={st.cardBody}>
          <Text style={[st.cardTitle, { color: c.INK }]}>{task.title}</Text>
          {task.body ? <Text style={[st.cardDesc, { color: c.INK_SOFT }]} numberOfLines={2}>{task.body}</Text> : null}
          <Text style={[st.cardFrom, { color: c.ACCENT }]}>от @{task.shared_by_handle}</Text>
          {due ? <Text style={[st.due, due.warn ? st.dueWarn : due.urgent ? st.dueUrgent : null]}>🕐 {due.text}</Text> : null}
          <View style={st.inviteRow}>
            <TouchableOpacity style={[st.inviteBtn, { backgroundColor: c.ACCENT }]} onPress={() => onAccept(task.id)} activeOpacity={0.7}>
              <Text style={st.inviteBtnText}>Принять</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[st.inviteBtn, { backgroundColor: c.WARM }]} onPress={() => onDecline(task.id)} activeOpacity={0.7}>
              <Text style={[st.inviteBtnText, { color: c.INK_SOFT }]}>Отклонить</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={[
      st.card,
      { backgroundColor: c.SURFACE, borderColor: c.LINE },
      isDone && { opacity: 0.55 },
      isHighPrio && !isDone && { borderLeftWidth: 3, borderLeftColor: prio.color },
    ]}>
      <TouchableOpacity style={st.checkWrap} onPress={() => onToggleDone(task.id)} activeOpacity={0.7}>
        <View style={[st.check, isDone && { backgroundColor: typeInfo.color, borderColor: typeInfo.color }]}>
          {isDone && <Feather name="check" size={11} color="#fff" />}
        </View>
      </TouchableOpacity>
      <View style={st.cardBody}>
        <View style={st.tagsRow}>
          <View style={[st.typeTag, { backgroundColor: typeInfo.color + "18", borderColor: typeInfo.color + "44" }]}>
            <Text style={[st.typeTagText, { color: typeInfo.color }]}>{typeInfo.icon} {typeInfo.label}</Text>
          </View>
          {task.category ? (
            <View style={[st.catTag, { backgroundColor: c.WARM }]}>
              <Text style={[st.catTagText, { color: c.INK_SOFT }]}>{task.category}</Text>
            </View>
          ) : null}
          {isHighPrio ? (
            <Text style={[st.highPrioTag, { color: prio.color }]}>↑ Срочно</Text>
          ) : null}
        </View>
        <Text style={[st.cardTitle, { color: c.INK }, isDone && st.strikethrough]} numberOfLines={2}>
          {task.title}
        </Text>
        {task.body ? <Text style={[st.cardDesc, { color: c.INK_SOFT }]} numberOfLines={2}>{task.body}</Text> : null}
        {due ? <Text style={[st.due, due.warn ? st.dueWarn : due.urgent ? st.dueUrgent : { color: c.INK_FAINT }]}>🕐 {due.text}</Text> : null}
        {task.shared_with_handle ? <Text style={[st.sharedTag, { color: c.INK_SOFT }]}>👤 @{task.shared_with_handle}</Text> : null}
      </View>
      <View style={st.cardActions}>
        <TouchableOpacity style={st.actBtn} onPress={() => onEdit(task)} activeOpacity={0.7}>
          <Feather name="edit-2" size={13} color={c.INK_SOFT} />
        </TouchableOpacity>
        <TouchableOpacity style={st.actBtn} onPress={() => onDelete(task.id)} activeOpacity={0.7}>
          <Feather name="trash-2" size={13} color="#e05a5a" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Task Form ──────────────────────────────────────────────────
function TaskForm({ initial, onSave, onCancel, saving }) {
  const c = useTheme();
  const [form, setForm] = useState(initial
    ? { title: initial.title || "", body: initial.body || "", type: initial.type || "task", priority: initial.priority || "normal", dueAt: initial.due_at || "", category: initial.category || "" }
    : EMPTY_FORM
  );

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  return (
    <View style={[st.formCard, { backgroundColor: c.SURFACE, borderColor: c.LINE }]}>
      <Text style={[st.formTitle, { color: c.INK }]}>{initial ? "Редактировать" : "Новая задача"}</Text>

      {/* Type */}
      <View style={st.typeRow}>
        {TYPES.map(tp => (
          <TouchableOpacity
            key={tp.value}
            style={[st.typePickBtn, { borderColor: form.type === tp.value ? tp.color : c.LINE }, form.type === tp.value && { backgroundColor: tp.color + "15" }]}
            onPress={() => set("type", tp.value)}
            activeOpacity={0.7}
          >
            <Text style={[st.typePickText, { color: form.type === tp.value ? tp.color : c.INK_SOFT }]}>{tp.icon} {tp.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Title */}
      <TextInput
        style={[st.input, { color: c.INK, backgroundColor: c.WARM, borderColor: c.LINE }]}
        value={form.title}
        onChangeText={v => set("title", v)}
        placeholder="Название задачи"
        placeholderTextColor={c.INK_FAINT}
        maxLength={200}
      />

      {/* Description */}
      <TextInput
        style={[st.input, st.textarea, { color: c.INK, backgroundColor: c.WARM, borderColor: c.LINE }]}
        value={form.body}
        onChangeText={v => set("body", v)}
        placeholder="Описание (необязательно)"
        placeholderTextColor={c.INK_FAINT}
        multiline
        numberOfLines={3}
        maxLength={1000}
      />

      {/* Due date */}
      <View style={st.field}>
        <Text style={[st.fieldLabel, { color: c.INK_SOFT }]}>Срок (ГГГГ-ММ-ДД ЧЧ:ММ)</Text>
        <TextInput
          style={[st.input, { color: c.INK, backgroundColor: c.WARM, borderColor: c.LINE }]}
          value={form.dueAt}
          onChangeText={v => set("dueAt", v)}
          placeholder="2024-12-31 18:00"
          placeholderTextColor={c.INK_FAINT}
        />
      </View>

      {/* Priority */}
      <View style={st.field}>
        <Text style={[st.fieldLabel, { color: c.INK_SOFT }]}>Приоритет</Text>
        <View style={st.pillRow}>
          {PRIOS.map(p => (
            <TouchableOpacity
              key={p.value}
              style={[st.pill, { borderColor: form.priority === p.value ? p.color : c.LINE }, form.priority === p.value && { backgroundColor: p.color + "15" }]}
              onPress={() => set("priority", p.value)}
              activeOpacity={0.7}
            >
              <Text style={[st.pillText, { color: form.priority === p.value ? p.color : c.INK_SOFT }]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Category */}
      <View style={st.field}>
        <Text style={[st.fieldLabel, { color: c.INK_SOFT }]}>Категория</Text>
        <View style={[st.pillRow, { flexWrap: "wrap" }]}>
          {CATS.map(cat => (
            <TouchableOpacity
              key={cat}
              style={[st.pill, { borderColor: form.category === cat ? c.ACCENT : c.LINE }, form.category === cat && { backgroundColor: c.ACCENT + "15" }]}
              onPress={() => set("category", form.category === cat ? "" : cat)}
              activeOpacity={0.7}
            >
              <Text style={[st.pillText, { color: form.category === cat ? c.ACCENT : c.INK_SOFT }]}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={st.formFooter}>
        <TouchableOpacity style={[st.formBtn, { backgroundColor: c.WARM }]} onPress={onCancel} activeOpacity={0.7}>
          <Text style={[st.formBtnLabel, { color: c.INK_SOFT }]}>Отмена</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[st.formBtn, { backgroundColor: c.ACCENT, opacity: (saving || !form.title.trim()) ? 0.5 : 1 }]}
          onPress={() => onSave(form)}
          disabled={saving || !form.title.trim()}
          activeOpacity={0.7}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={[st.formBtnLabel, { color: "#fff" }]}>{initial ? "Сохранить" : "Создать"}</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────
export default function PlannerScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const c = useTheme();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState("active");
  const [showForm, setShowForm] = useState(false);
  const [editTask, setEditTask] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api("/planner");
      setData(d);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const create = async (form) => {
    setSaving(true);
    try {
      const result = await api("/planner", { method: "POST", body: { title: form.title, body: form.body, type: form.type, priority: form.priority, due_at: form.dueAt || null, category: form.category || null } });
      setData(result); setShowForm(false);
    } catch (e) { Alert.alert("Ошибка", e.message); }
    setSaving(false);
  };

  const update = async (form) => {
    setSaving(true);
    try {
      const result = await api(`/planner/${editTask.id}`, { method: "PATCH", body: { title: form.title, body: form.body, type: form.type, priority: form.priority, due_at: form.dueAt || null, category: form.category || null } });
      setData(result); setEditTask(null);
    } catch (e) { Alert.alert("Ошибка", e.message); }
    setSaving(false);
  };

  const toggleDone = async (id) => {
    try {
      const result = await api(`/planner/${id}/done`, { method: "POST" });
      setData(result);
    } catch {}
  };

  const remove = (id) => {
    Alert.alert("Удалить задачу?", "Это действие необратимо.", [
      { text: "Отмена", style: "cancel" },
      { text: "Удалить", style: "destructive", onPress: async () => {
        try { const result = await api(`/planner/${id}`, { method: "DELETE" }); setData(result); } catch {}
      }},
    ]);
  };

  const respond = async (id, accept) => {
    try {
      const result = await api(`/planner/${id}/respond`, { method: "POST", body: { accept } });
      setData(result);
    } catch {}
  };

  const own = data?.own || [];
  const active = own.filter(tk => tk.status === "active");
  const done = own.filter(tk => tk.status === "done");
  const sharedWithMe = data?.sharedWithMe || [];
  const pendingForMe = data?.pendingForMe || [];
  const pendingCount = pendingForMe.length;

  const TABS = [
    { key: "active", label: `Активные (${active.length})` },
    { key: "shared", label: pendingCount > 0 ? `Общие ● ${pendingCount}` : "Общие" },
    { key: "done",   label: `Готово (${done.length})` },
  ];

  return (
    <View style={[st.root, { backgroundColor: c.BG, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[st.header, { backgroundColor: c.SURFACE, borderBottomColor: c.LINE }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color={c.ACCENT} />
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: c.INK }]}>Планировщик</Text>
        <TouchableOpacity
          onPress={() => { setShowForm(v => !v); setEditTask(null); }}
          style={st.addBtn}
          activeOpacity={0.7}
        >
          <Feather name={showForm && !editTask ? "x" : "plus"} size={20} color={c.ACCENT} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[st.tabsScroll, { backgroundColor: c.SURFACE, borderBottomColor: c.LINE }]}>
        <View style={st.tabsRow}>
          {TABS.map(tb => (
            <TouchableOpacity
              key={tb.key}
              style={[st.tabBtn, tab === tb.key && { borderBottomColor: c.ACCENT }]}
              onPress={() => setTab(tb.key)}
              activeOpacity={0.7}
            >
              <Text style={[st.tabLabel, { color: tab === tb.key ? c.ACCENT : c.INK_SOFT }]}>{tb.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.ACCENT} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Form (new task) */}
        {showForm && !editTask && (
          <TaskForm onSave={create} onCancel={() => setShowForm(false)} saving={saving} />
        )}
        {/* Form (edit task) */}
        {editTask && (
          <TaskForm initial={editTask} onSave={update} onCancel={() => setEditTask(null)} saving={saving} />
        )}

        {loading ? (
          <ActivityIndicator color={c.ACCENT} style={{ marginTop: 40 }} />
        ) : tab === "active" ? (
          active.length === 0 ? (
            <View style={st.empty}>
              <Text style={st.emptyIco}>✓</Text>
              <Text style={[st.emptyTitle, { color: c.INK }]}>Нет активных задач</Text>
              <Text style={[st.emptySub, { color: c.INK_SOFT }]}>Нажми + чтобы создать первую задачу</Text>
            </View>
          ) : active.map(tk => (
            <TaskCard key={tk.id} task={tk} onToggleDone={toggleDone} onEdit={(t) => { setEditTask(t); setShowForm(false); }} onDelete={remove} />
          ))
        ) : tab === "shared" ? (
          <>
            {pendingForMe.map(tk => (
              <TaskCard key={tk.id} task={tk} isPending onAccept={(id) => respond(id, true)} onDecline={(id) => respond(id, false)} />
            ))}
            {sharedWithMe.length > 0 && (
              <>
                <Text style={[st.sectionLabel, { color: c.INK_SOFT }]}>Принятые</Text>
                {sharedWithMe.map(tk => (
                  <TaskCard key={tk.id} task={tk} onToggleDone={toggleDone} onEdit={(t) => { setEditTask(t); setShowForm(false); }} onDelete={remove} />
                ))}
              </>
            )}
            {own.filter(tk => tk.shared_with_id).length > 0 && (
              <>
                <Text style={[st.sectionLabel, { color: c.INK_SOFT }]}>Отправленные мной</Text>
                {own.filter(tk => tk.shared_with_id).map(tk => (
                  <TaskCard key={tk.id} task={tk} onToggleDone={toggleDone} onEdit={(t) => { setEditTask(t); setShowForm(false); }} onDelete={remove} />
                ))}
              </>
            )}
            {pendingCount === 0 && sharedWithMe.length === 0 && own.filter(tk => tk.shared_with_id).length === 0 && (
              <View style={st.empty}>
                <Text style={st.emptyIco}>👥</Text>
                <Text style={[st.emptyTitle, { color: c.INK }]}>Нет общих задач</Text>
              </View>
            )}
          </>
        ) : (
          done.length === 0 ? (
            <View style={st.empty}>
              <Text style={st.emptyIco}>🎯</Text>
              <Text style={[st.emptyTitle, { color: c.INK }]}>Нет завершённых задач</Text>
            </View>
          ) : done.map(tk => (
            <TaskCard key={tk.id} task={tk} onToggleDone={toggleDone} onEdit={(t) => { setEditTask(t); setShowForm(false); }} onDelete={remove} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root:    { flex: 1 },
  header:  { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", textAlign: "center" },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  addBtn:  { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  tabsScroll: { borderBottomWidth: StyleSheet.hairlineWidth, maxHeight: 46 },
  tabsRow:  { flexDirection: "row", paddingHorizontal: 10 },
  tabBtn:   { paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabLabel: { fontSize: 13, fontWeight: "600" },

  card:      { flexDirection: "row", borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginBottom: 10, overflow: "hidden" },
  cardLeft:  { width: 40, alignItems: "center", justifyContent: "center", borderRightWidth: StyleSheet.hairlineWidth },
  typeIcon:  { fontSize: 18 },
  checkWrap: { width: 48, alignItems: "center", justifyContent: "flex-start", paddingTop: 15 },
  check:     { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5, borderColor: "#aaa", alignItems: "center", justifyContent: "center" },
  cardBody:  { flex: 1, padding: 11 },
  tagsRow:   { flexDirection: "row", flexWrap: "wrap", gap: 5, marginBottom: 5 },
  typeTag:   { flexDirection: "row", alignItems: "center", borderRadius: 6, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 2 },
  typeTagText:{ fontSize: 11, fontWeight: "600" },
  catTag:    { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  catTagText:{ fontSize: 11 },
  highPrioTag:{ fontSize: 11, fontWeight: "700" },
  cardTitle: { fontSize: 14, fontWeight: "600", lineHeight: 19 },
  cardDesc:  { fontSize: 12, marginTop: 3, lineHeight: 17 },
  cardFrom:  { fontSize: 12, marginTop: 4, fontWeight: "600" },
  strikethrough: { textDecorationLine: "line-through" },
  due:       { fontSize: 11, marginTop: 4 },
  dueWarn:   { color: "#e05a5a" },
  dueUrgent: { color: "#d99a2b" },
  sharedTag: { fontSize: 11, marginTop: 3 },
  cardActions:{ flexDirection: "column", gap: 6, padding: 10, alignItems: "center", justifyContent: "center" },
  actBtn:    { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  inviteRow: { flexDirection: "row", gap: 8, marginTop: 8 },
  inviteBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  inviteBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },

  formCard:  { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginBottom: 14 },
  formTitle: { fontSize: 16, fontWeight: "700", marginBottom: 14 },
  typeRow:   { flexDirection: "row", gap: 8, marginBottom: 12 },
  typePickBtn:{ flex: 1, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, alignItems: "center" },
  typePickText:{ fontSize: 11, fontWeight: "600" },
  input:     { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, marginBottom: 10 },
  textarea:  { height: 80, textAlignVertical: "top" },
  field:     { marginBottom: 10 },
  fieldLabel:{ fontSize: 12, fontWeight: "600", marginBottom: 5 },
  pillRow:   { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  pill:      { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  pillText:  { fontSize: 12, fontWeight: "600" },
  formFooter:{ flexDirection: "row", gap: 10, marginTop: 6 },
  formBtn:   { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: "center" },
  formBtnLabel:{ fontSize: 14, fontWeight: "700" },

  sectionLabel:{ fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 10, marginBottom: 6 },
  empty:     { alignItems: "center", paddingTop: 60, paddingHorizontal: 20 },
  emptyIco:  { fontSize: 48, marginBottom: 14 },
  emptyTitle:{ fontSize: 17, fontWeight: "700", marginBottom: 8 },
  emptySub:  { fontSize: 14, textAlign: "center", lineHeight: 20, color: "#888" },
});
