import { useState, useEffect } from "react";
import { View, Text, StyleSheet, ActivityIndicator } from "react-native";
import { api } from "../lib/api.js";
import { useTheme } from "../store/theme.js";

const ALL_ACHIEVEMENTS = [
  { type: "first_post",     emoji: "✍️", label: "Первопроходец", desc: "Опубликовал первый пост", rarity: "common" },
  { type: "first_comment",  emoji: "💬", label: "Голос в толпе",   desc: "Оставил первый комментарий", rarity: "common" },
  { type: "first_reaction", emoji: "❤️", label: "Эмоциональный",  desc: "Поставил первую реакцию", rarity: "common" },
  { type: "collab_debut",   emoji: "🤝", label: "Соавтор",          desc: "Участвовал в сборном посте", rarity: "rare" },
  { type: "popular_post",   emoji: "🔥", label: "В тренде",         desc: "Пост набрал 50+ просмотров", rarity: "epic" },
];

const RARITY = {
  common: { bg: null,      border: null,      text: null,      label: null },
  rare:   { bg: "#60a5fa18", border: "#60a5fa55", text: "#60a5fa", label: "Редкое" },
  epic:   { bg: "#a78bfa18", border: "#a78bfa55", text: "#a78bfa", label: "Эпическое" },
  legend: { bg: "#f59e0b18", border: "#f59e0b55", text: "#f59e0b", label: "Легендарное" },
};

function AchCard({ ach, unlocked, unlockedAt }) {
  const c = useTheme();
  const r = unlocked ? RARITY[ach.rarity] : RARITY.common;

  return (
    <View style={[
      st.card,
      { backgroundColor: unlocked ? (r.bg || c.WARM) : `${c.LINE}40`, borderColor: unlocked ? (r.border || c.LINE) : c.LINE },
      !unlocked && st.cardLocked,
    ]}>
      <Text style={[st.emoji, !unlocked && st.emojiLocked]}>{ach.emoji}</Text>
      <View style={st.info}>
        <Text style={[st.label, { color: unlocked ? c.INK : c.INK_SOFT }]} numberOfLines={1}>
          {ach.label}
        </Text>
        <Text style={[st.desc, { color: c.INK_SOFT }]} numberOfLines={2}>
          {ach.desc}
        </Text>
        {unlocked && r.label && (
          <Text style={[st.rarityLabel, { color: r.text }]}>{r.label}</Text>
        )}
        {unlocked && unlockedAt && (
          <Text style={[st.date, { color: c.INK_SOFT }]}>
            {new Date(unlockedAt).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
          </Text>
        )}
      </View>
      <Text style={[st.badge, { color: unlocked ? (r.text || c.ACCENT) : c.INK_SOFT }]}>
        {unlocked ? "✦" : "🔒"}
      </Text>
    </View>
  );
}

export default function Achievements({ handle }) {
  const c = useTheme();
  const [earned, setEarned]   = useState(null);
  const [map, setMap]         = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!handle) return;
    api(`/achievements/${handle}`)
      .then(arr => {
        const m = {};
        arr.forEach(a => { m[a.type] = a.unlocked_at || true; });
        setEarned(new Set(arr.map(a => a.type)));
        setMap(m);
      })
      .catch(() => setEarned(new Set()))
      .finally(() => setLoading(false));
  }, [handle]);

  if (loading) {
    return (
      <View style={st.loading}>
        <ActivityIndicator color={c.ACCENT} size="small" />
      </View>
    );
  }

  if (!earned) return null;

  const earnedCount = earned.size;
  const total = ALL_ACHIEVEMENTS.length;
  const pct = total > 0 ? Math.round((earnedCount / total) * 100) : 0;

  return (
    <View style={[st.block, { backgroundColor: c.SURFACE }]}>
      {/* Header */}
      <View style={st.header}>
        <View style={st.headerLeft}>
          <Text style={[st.title, { color: c.INK }]}>Достижения</Text>
          <View style={[st.countBadge, { backgroundColor: `${c.ACCENT}15` }]}>
            <Text style={[st.countText, { color: c.ACCENT }]}>{earnedCount} / {total}</Text>
          </View>
        </View>
        <View style={st.progressWrap}>
          <View style={[st.progressBar, { backgroundColor: c.LINE }]}>
            <View style={[st.progressFill, { width: `${pct}%`, backgroundColor: c.ACCENT }]} />
          </View>
          <Text style={[st.pct, { color: c.INK_SOFT }]}>{pct}%</Text>
        </View>
      </View>

      {/* Cards */}
      <View style={st.cards}>
        {ALL_ACHIEVEMENTS.map(ach => (
          <AchCard
            key={ach.type}
            ach={ach}
            unlocked={earned.has(ach.type)}
            unlockedAt={map[ach.type]}
          />
        ))}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  loading:      { paddingVertical: 16, alignItems: "center" },
  block:        { marginHorizontal: 16, marginBottom: 16, borderRadius: 20, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  header:       { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  headerLeft:   { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  title:        { fontSize: 15, fontWeight: "800" },
  countBadge:   { paddingHorizontal: 9, paddingVertical: 2, borderRadius: 12 },
  countText:    { fontSize: 12, fontWeight: "700" },
  progressWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  progressBar:  { flex: 1, height: 6, borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 3 },
  pct:          { fontSize: 11, fontWeight: "600", minWidth: 32, textAlign: "right" },
  cards:        { paddingHorizontal: 12, paddingBottom: 12, gap: 6 },

  card:         { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  cardLocked:   { opacity: 0.55 },
  emoji:        { fontSize: 24, width: 34, textAlign: "center" },
  emojiLocked:  { opacity: 0.4, fontSize: 20 },
  info:         { flex: 1, gap: 2 },
  label:        { fontSize: 14, fontWeight: "700" },
  desc:         { fontSize: 12.5, lineHeight: 17 },
  rarityLabel:  { fontSize: 11, fontWeight: "700", marginTop: 1 },
  date:         { fontSize: 11, marginTop: 1 },
  badge:        { fontSize: 16 },
});
