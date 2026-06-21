import { useState, useEffect, useCallback } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  TextInput, ActivityIndicator, Alert, RefreshControl, Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { api } from "../lib/api.js";
import { useTheme } from "../store/theme.js";

// ── Helpers ────────────────────────────────────────────────────
function daysUntil(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  let next = new Date(today.getFullYear(), m - 1, d);
  if (next < today) next.setFullYear(today.getFullYear() + 1);
  return Math.round((next - today) / 86400000);
}

function yearsSince(dateStr) {
  return new Date().getFullYear() - Number(dateStr.slice(0, 4));
}

function fmtDate(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}.${m}.${y}`;
}

function dayWord(n) {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 19) return "дней";
  if (mod10 === 1) return "день";
  if (mod10 >= 2 && mod10 <= 4) return "дня";
  return "дней";
}

function yearWord(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 19) return "лет";
  if (mod10 === 1) return "год";
  if (mod10 >= 2 && mod10 <= 4) return "года";
  return "лет";
}

const TYPES = [
  { value: "custom",     label: "Особое",   icon: "⭐", accent: "#d99a2b" },
  { value: "friend",     label: "Друг",     icon: "👥", accent: "#5b9e6e" },
  { value: "first_post", label: "Первый пост", icon: "📝", accent: "#5fa8d3" },
  { value: "birthday",   label: "День рождения", icon: "🎂", accent: "#f472b6" },
];

const EMPTY_FORM = { date: "", label: "", type: "custom", personHandle: "" };

// ── Date Card ──────────────────────────────────────────────────
function DateCard({ date, onEdit, onDelete }) {
  const c = useTheme();
  const days = daysUntil(date.date);
  const isToday = days === 0;
  const years = yearsSince(date.date);
  const typeData = TYPES.find(t => t.value === date.type) || TYPES[0];
  const handles = date.person_handle
    ? date.person_handle.split(",").map(h => h.trim()).filter(Boolean)
    : [];

  let countdownText;
  if (isToday) countdownText = "Сегодня! 🎊";
  else if (days > 0) countdownText = `через ${days} ${dayWord(days)}`;
  else countdownText = `${Math.abs(days)} ${dayWord(days)} назад`;

  return (
    <View style={[st.card, { backgroundColor: c.SURFACE, borderColor: c.LINE }]}>
      <View style={[st.cardAccent, { backgroundColor: typeData.accent }]} />
      <View style={st.cardIconWrap}>
        <Text style={st.cardIcon}>{typeData.icon}</Text>
      </View>
      <View style={st.cardBody}>
        <View style={st.cardRow}>
          <Text style={[st.cardTitle, { color: c.INK }]} numberOfLines={1}>{date.label}</Text>
          <View style={[st.countdownBadge, { backgroundColor: isToday ? typeData.accent : c.WARM }]}>
            <Text style={[st.countdownText, { color: isToday ? "#fff" : c.INK_SOFT }]}>{countdownText}</Text>
          </View>
        </View>
        <Text style={[st.cardMeta, { color: c.INK_SOFT }]}>
          {fmtDate(date.date)}{years > 0 ? ` · ${years} ${yearWord(years)}` : ""}
        </Text>
        {handles.length > 0 && (
          <Text style={[st.cardHandles, { color: c.ACCENT }]}>
            {handles.map(h => `@${h}`).join(" ")}
          </Text>
        )}
      </View>
      <View style={st.cardActions}>
        <TouchableOpacity onPress={() => onEdit(date)} style={st.iconBtn} activeOpacity={0.7}>
          <Feather name="edit-2" size={14} color={c.INK_SOFT} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onDelete(date.id)} style={st.iconBtn} activeOpacity={0.7}>
          <Feather name="trash-2" size={14} color="#e05a5a" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Group header ───────────────────────────────────────────────
function GroupHeader({ label }) {
  const c = useTheme();
  return (
    <View style={st.groupHeader}>
      <Text style={[st.groupLabel, { color: c.INK_SOFT }]}>{label}</Text>
      <View style={[st.groupLine, { backgroundColor: c.LINE }]} />
    </View>
  );
}

// ── Add / Edit form ────────────────────────────────────────────
function DateForm({ form, setForm, onSave, onCancel, isEdit, saving }) {
  const c = useTheme();

  return (
    <View style={[st.formCard, { backgroundColor: c.SURFACE, borderColor: c.LINE }]}>
      <Text style={[st.formTitle, { color: c.INK }]}>
        {isEdit ? "Редактировать дату" : "Добавить дату"}
      </Text>

      {/* Type picker */}
      <View style={st.typeGrid}>
        {TYPES.map(ty => (
          <TouchableOpacity
            key={ty.value}
            style={[st.typeBtn, form.type === ty.value && { borderColor: ty.accent, backgroundColor: `${ty.accent}15` }]}
            onPress={() => setForm(f => ({ ...f, type: ty.value }))}
            activeOpacity={0.7}
          >
            <Text style={st.typeBtnIcon}>{ty.icon}</Text>
            <Text style={[st.typeBtnLabel, { color: form.type === ty.value ? ty.accent : c.INK_SOFT }]}>
              {ty.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Label */}
      <View style={st.field}>
        <Text style={[st.fieldLabel, { color: c.INK_SOFT }]}>Название</Text>
        <TextInput
          style={[st.input, { color: c.INK, backgroundColor: c.WARM, borderColor: c.LINE }]}
          value={form.label}
          onChangeText={v => setForm(f => ({ ...f, label: v }))}
          placeholder="Напр., День знакомства"
          placeholderTextColor={c.INK_FAINT}
          maxLength={120}
        />
      </View>

      {/* Date (YYYY-MM-DD) */}
      <View style={st.field}>
        <Text style={[st.fieldLabel, { color: c.INK_SOFT }]}>Дата (ГГГГ-ММ-ДД)</Text>
        <TextInput
          style={[st.input, { color: c.INK, backgroundColor: c.WARM, borderColor: c.LINE }]}
          value={form.date}
          onChangeText={v => setForm(f => ({ ...f, date: v }))}
          placeholder="2024-06-15"
          placeholderTextColor={c.INK_FAINT}
          keyboardType="numeric"
          maxLength={10}
        />
      </View>

      {/* Person handle */}
      <View style={st.field}>
        <Text style={[st.fieldLabel, { color: c.INK_SOFT }]}>Люди (хэндлы через запятую)</Text>
        <TextInput
          style={[st.input, { color: c.INK, backgroundColor: c.WARM, borderColor: c.LINE }]}
          value={form.personHandle}
          onChangeText={v => setForm(f => ({ ...f, personHandle: v }))}
          placeholder="@user1, @user2"
          placeholderTextColor={c.INK_FAINT}
          autoCapitalize="none"
        />
      </View>

      <View style={st.formActions}>
        {isEdit && (
          <TouchableOpacity style={[st.formBtn, { backgroundColor: c.WARM }]} onPress={onCancel} activeOpacity={0.7}>
            <Text style={[st.formBtnText, { color: c.INK_SOFT }]}>Отмена</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[st.formBtn, st.formBtnAccent, { backgroundColor: c.ACCENT, opacity: saving ? 0.6 : 1 }]}
          onPress={onSave}
          disabled={saving || !form.date.trim() || !form.label.trim()}
          activeOpacity={0.7}
        >
          {saving
            ? <ActivityIndicator size="small" color="#fff" />
            : <Text style={st.formBtnTextWhite}>{isEdit ? "Сохранить" : "Добавить"}</Text>
          }
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Screen ─────────────────────────────────────────────────────
export default function MemorableDatesScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const [dates, setDates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editId, setEditId] = useState(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api("/memorable-dates");
      setDates(Array.isArray(data) ? data : []);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const save = async () => {
    if (!form.date.trim() || !form.label.trim()) return;
    const dateStr = form.date.trim().slice(0, 10); // ensure YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      Alert.alert("Ошибка", "Формат даты: ГГГГ-ММ-ДД (напр. 2024-06-15)");
      return;
    }
    setSaving(true);
    try {
      const body = { ...form, date: dateStr };
      let result;
      if (editId) {
        result = await api(`/memorable-dates/${editId}`, { method: "PATCH", body });
      } else {
        result = await api("/memorable-dates", { method: "POST", body });
      }
      setDates(Array.isArray(result) ? result : dates);
      setForm(EMPTY_FORM);
      setEditId(null);
      setShowForm(false);
    } catch (e) {
      Alert.alert("Ошибка", e.message || "Не удалось сохранить");
    }
    setSaving(false);
  };

  const startEdit = (date) => {
    setForm({ date: date.date, label: date.label, type: date.type, personHandle: date.person_handle || "" });
    setEditId(date.id);
    setShowForm(true);
  };

  const cancelEdit = () => {
    setForm(EMPTY_FORM);
    setEditId(null);
    setShowForm(false);
  };

  const del = (id) => {
    Alert.alert("Удалить дату?", "Это действие необратимо.", [
      { text: "Отмена", style: "cancel" },
      { text: "Удалить", style: "destructive", onPress: async () => {
        try {
          const result = await api(`/memorable-dates/${id}`, { method: "DELETE" });
          setDates(Array.isArray(result) ? result : (dates || []).filter(d => d.id !== id));
        } catch {}
      }},
    ]);
  };

  const today    = (dates || []).filter(d => daysUntil(d.date) === 0);
  const upcoming = (dates || []).filter(d => { const n = daysUntil(d.date); return n > 0 && n <= 14; });
  const rest     = (dates || []).filter(d => daysUntil(d.date) > 14).sort((a, b) => daysUntil(a.date) - daysUntil(b.date));
  const past     = (dates || []).filter(d => daysUntil(d.date) < 0).sort((a, b) => daysUntil(b.date) - daysUntil(a.date));

  return (
    <View style={[st.root, { backgroundColor: c.BG, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[st.header, { backgroundColor: c.SURFACE, borderBottomColor: c.LINE }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={20} color={c.ACCENT} />
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: c.INK }]}>Памятные даты</Text>
        <TouchableOpacity
          onPress={() => { setShowForm(v => !v); if (showForm) cancelEdit(); }}
          style={st.addBtn}
          activeOpacity={0.7}
        >
          <Feather name={showForm ? "x" : "plus"} size={20} color={c.ACCENT} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 20 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.ACCENT} />}
        showsVerticalScrollIndicator={false}
      >
        {showForm && (
          <DateForm
            form={form}
            setForm={setForm}
            onSave={save}
            onCancel={cancelEdit}
            isEdit={!!editId}
            saving={saving}
          />
        )}

        {loading ? (
          <ActivityIndicator color={c.ACCENT} style={{ marginTop: 40 }} />
        ) : !dates || dates.length === 0 ? (
          <View style={st.empty}>
            <Text style={st.emptyIco}>🗓️</Text>
            <Text style={[st.emptyTitle, { color: c.INK }]}>Нет памятных дат</Text>
            <Text style={[st.emptySub, { color: c.INK_SOFT }]}>Добавь важные события, дни рождения или годовщины</Text>
            <TouchableOpacity style={[st.emptyBtn, { backgroundColor: c.ACCENT }]} onPress={() => setShowForm(true)} activeOpacity={0.7}>
              <Text style={st.emptyBtnText}>Добавить дату</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            {today.length > 0 && (
              <>
                <GroupHeader label="Сегодня 🎊" />
                {today.map(d => <DateCard key={d.id} date={d} onEdit={startEdit} onDelete={del} />)}
              </>
            )}
            {upcoming.length > 0 && (
              <>
                <GroupHeader label="Ближайшие 14 дней" />
                {upcoming.map(d => <DateCard key={d.id} date={d} onEdit={startEdit} onDelete={del} />)}
              </>
            )}
            {rest.length > 0 && (
              <>
                <GroupHeader label="Будущие" />
                {rest.map(d => <DateCard key={d.id} date={d} onEdit={startEdit} onDelete={del} />)}
              </>
            )}
            {past.length > 0 && (
              <>
                <GroupHeader label="Прошедшие" />
                {past.map(d => <DateCard key={d.id} date={d} onEdit={startEdit} onDelete={del} />)}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root:        { flex: 1 },
  header:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: "700", textAlign: "center" },
  backBtn:     { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  addBtn:      { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  card:        { flexDirection: "row", alignItems: "center", borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, marginBottom: 10, overflow: "hidden" },
  cardAccent:  { width: 4, alignSelf: "stretch" },
  cardIconWrap:{ width: 42, alignItems: "center", justifyContent: "center" },
  cardIcon:    { fontSize: 22 },
  cardBody:    { flex: 1, paddingVertical: 11, paddingRight: 4 },
  cardRow:     { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  cardTitle:   { fontSize: 14, fontWeight: "700", flex: 1 },
  cardMeta:    { fontSize: 12, marginTop: 2 },
  cardHandles: { fontSize: 12, marginTop: 3 },
  countdownBadge: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  countdownText:  { fontSize: 11, fontWeight: "600" },
  cardActions: { flexDirection: "column", alignItems: "center", gap: 6, paddingHorizontal: 10 },
  iconBtn:     { width: 28, height: 28, alignItems: "center", justifyContent: "center" },

  groupHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8, marginTop: 6 },
  groupLabel:  { fontSize: 12, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase" },
  groupLine:   { flex: 1, height: 1 },

  formCard:    { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 16, marginBottom: 14 },
  formTitle:   { fontSize: 16, fontWeight: "700", marginBottom: 14 },
  typeGrid:    { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 14 },
  typeBtn:     { flex: 1, minWidth: "45%", alignItems: "center", paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: "transparent", backgroundColor: "rgba(128,128,128,0.06)", gap: 4 },
  typeBtnIcon: { fontSize: 20 },
  typeBtnLabel:{ fontSize: 12, fontWeight: "600" },
  field:       { marginBottom: 12 },
  fieldLabel:  { fontSize: 12, fontWeight: "600", marginBottom: 5 },
  input:       { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  formActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  formBtn:     { flex: 1, paddingVertical: 11, borderRadius: 12, alignItems: "center" },
  formBtnAccent: {},
  formBtnText: { fontSize: 14, fontWeight: "600" },
  formBtnTextWhite: { fontSize: 14, fontWeight: "700", color: "#fff" },

  empty:       { alignItems: "center", paddingTop: 60, paddingHorizontal: 20 },
  emptyIco:    { fontSize: 52, marginBottom: 14 },
  emptyTitle:  { fontSize: 18, fontWeight: "700", marginBottom: 8 },
  emptySub:    { fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 20 },
  emptyBtn:    { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  emptyBtnText:{ color: "#fff", fontWeight: "700", fontSize: 15 },
});
