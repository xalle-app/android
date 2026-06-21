import { useState, useCallback, useMemo } from "react";
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { api } from "../lib/api.js";
import { haptic } from "../lib/haptics.js";
import { useTheme } from "../store/theme.js";

function fmtCountdown(ms) {
  if (ms <= 0) return "Завершён";
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  if (d > 0) return `${d}д ${h % 24}ч`;
  if (h > 0) return `${h}ч ${m % 60}м`;
  if (m > 0) return `${m}м ${s % 60}с`;
  return `${s}с`;
}

export default function PollCard({ poll, postId, isMine }) {
  const c = useTheme();
  const parsed = useMemo(() => {
    if (!poll) return null;
    try { return typeof poll === "string" ? JSON.parse(poll) : poll; }
    catch { return null; }
  }, [poll]);

  if (!parsed) return null;

  const { question, options = [], anonymous, multiChoice, allowUnvote, expiresAt, counts = {}, total = 0, userVote, userVotes = [] } = parsed;

  const closed = expiresAt ? new Date(expiresAt) <= new Date() : false;
  const initVotes = userVotes.length ? userVotes : (userVote != null ? [userVote] : []);

  const [localCounts, setLocalCounts] = useState(counts);
  const [localTotal, setLocalTotal]   = useState(total);
  const [localVotes, setLocalVotes]   = useState(initVotes);
  const [busy, setBusy] = useState(false);

  const showResults = localVotes.length > 0 || closed;

  const pct = (idx) => {
    if (!localTotal) return 0;
    return Math.round(((localCounts[idx] || 0) / localTotal) * 100);
  };

  const vote = useCallback(async (idx) => {
    if (busy || closed) return;
    haptic.light();
    const isUnvote = localVotes.includes(idx) && allowUnvote;
    setBusy(true);
    try {
      if (isUnvote) {
        await api(`/posts/${postId}/vote/cancel`, { method: "DELETE", body: { optionIndex: idx } });
        setLocalVotes(prev => prev.filter(v => v !== idx));
        setLocalCounts(prev => ({ ...prev, [idx]: Math.max(0, (prev[idx] || 1) - 1) }));
        setLocalTotal(prev => Math.max(0, prev - 1));
      } else {
        await api(`/posts/${postId}/vote`, { method: "POST", body: { optionIdx: idx, multiChoice: !!multiChoice } });
        if (!multiChoice) {
          const oldIdx = localVotes[0];
          if (oldIdx != null) {
            setLocalCounts(prev => ({ ...prev, [oldIdx]: Math.max(0, (prev[oldIdx] || 1) - 1) }));
            setLocalTotal(prev => Math.max(0, prev - 1));
          }
          setLocalVotes([idx]);
        } else {
          setLocalVotes(prev => [...prev, idx]);
        }
        setLocalCounts(prev => ({ ...prev, [idx]: (prev[idx] || 0) + 1 }));
        setLocalTotal(prev => prev + 1);
        haptic.success();
      }
    } catch {}
    setBusy(false);
  }, [busy, closed, localVotes, allowUnvote, multiChoice, postId]);

  return (
    <View style={[st.card, { backgroundColor: c.WARM, borderColor: c.LINE }]}>
      <Text style={[st.question, { color: c.INK }]}>{question}</Text>

      {options.map((opt, i) => {
        const p = pct(i);
        const isMe = localVotes.includes(i);
        return (
          <TouchableOpacity
            key={i}
            style={[st.option, { backgroundColor: c.SURFACE, borderColor: c.LINE }, isMe && { borderColor: `${c.ACCENT}60` }, showResults && st.optionResult]}
            onPress={() => !closed && vote(i)}
            activeOpacity={closed ? 1 : 0.7}
            disabled={busy || closed}
          >
            {showResults && (
              <View style={[st.bar, { width: `${p}%`, backgroundColor: isMe ? `${c.ACCENT}22` : `${c.ACCENT}14` }]} />
            )}
            <View style={st.optionInner}>
              {multiChoice ? (
                <View style={[st.checkbox, { borderColor: c.LINE }, isMe && { backgroundColor: c.ACCENT, borderColor: c.ACCENT }]}>
                  {isMe && <Feather name="check" size={10} color="#fff" />}
                </View>
              ) : (
                <View style={[st.radio, { borderColor: isMe ? c.ACCENT : c.LINE }]}>
                  {isMe && <View style={[st.radioDot, { backgroundColor: c.ACCENT }]} />}
                </View>
              )}
              <Text style={[st.optText, { color: c.INK }, isMe && { fontWeight: "600" }]} numberOfLines={2}>{opt}</Text>
              {showResults && (
                <Text style={[st.pct, { color: isMe ? c.ACCENT : c.INK_SOFT }]}>{p}%</Text>
              )}
            </View>
          </TouchableOpacity>
        );
      })}

      <View style={st.footer}>
        {busy && <ActivityIndicator size="small" color={c.ACCENT} style={{ marginRight: 8 }} />}
        <Text style={[st.meta, { color: c.INK_SOFT }]}>
          {localTotal} {localTotal === 1 ? "голос" : localTotal < 5 ? "голоса" : "голосов"}
          {anonymous ? " · Анонимно" : ""}
          {multiChoice ? " · Несколько вариантов" : ""}
        </Text>
        {expiresAt && (
          <Text style={[st.meta, { color: c.INK_SOFT, marginLeft: "auto" }]}>
            {closed ? "Завершён" : `⏰ ${fmtCountdown(new Date(expiresAt) - Date.now())}`}
          </Text>
        )}
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  card:        { borderRadius: 14, padding: 14, marginVertical: 8, borderWidth: 1 },
  question:    { fontSize: 15, fontWeight: "700", marginBottom: 10, lineHeight: 21 },
  option:      { borderRadius: 10, marginBottom: 6, overflow: "hidden", borderWidth: 1, position: "relative" },
  optionResult:{ opacity: 1 },
  bar:         { position: "absolute", top: 0, left: 0, bottom: 0, borderRadius: 10 },
  optionInner: { flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 12, paddingVertical: 10 },
  checkbox:    { width: 18, height: 18, borderRadius: 4, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radio:       { width: 18, height: 18, borderRadius: 9, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  radioDot:    { width: 8, height: 8, borderRadius: 4 },
  optText:     { flex: 1, fontSize: 14, lineHeight: 19 },
  pct:         { fontSize: 12.5, fontWeight: "700", minWidth: 36, textAlign: "right" },
  footer:      { flexDirection: "row", alignItems: "center", marginTop: 6 },
  meta:        { fontSize: 12 },
});
