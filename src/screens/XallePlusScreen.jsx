import { useState, useEffect } from "react";
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { api } from "../lib/api.js";
import { haptic } from "../lib/haptics.js";
import { useAuthStore } from "../store/auth.js";
import { useTheme } from "../store/theme.js";

const MONTH_OPTS = [1, 3, 6, 12];
const DISCOUNT = { 1: 0, 3: 5, 6: 10, 12: 20 };
const SPARKS_BASE = { plus: 300, premium: 600 };

function calcSparks(plan, months) {
  const base = SPARKS_BASE[plan] * months;
  const disc = DISCOUNT[months] / 100;
  return Math.floor(base * (1 - disc));
}

const PERKS = {
  plus: [
    { icon: "🌈", title: "Градиент имени", desc: "Красочные цвета для имени в постах и чатах" },
    { icon: "📝", title: "Длинные посты", desc: "До 5000 символов вместо 3000" },
    { icon: "👥", title: "Больше соавторов", desc: "До 5 соавторов в сборных постах" },
    { icon: "⚡", title: "Искра в подарок", desc: "+300 ✦ при первой подписке" },
  ],
  premium: [
    { icon: "🌈", title: "Градиент имени", desc: "Красочные цвета для имени в постах и чатах" },
    { icon: "📝", title: "Длинные посты", desc: "До 10 000 символов" },
    { icon: "👥", title: "Больше соавторов", desc: "До 15 соавторов в сборных постах" },
    { icon: "◆", title: "Значок Premium", desc: "Особый бейдж рядом с именем" },
    { icon: "⚡", title: "Больше Искры", desc: "+600 ✦ при первой подписке" },
    { icon: "🎵", title: "Приоритет треков", desc: "Треки показываются выше в ленте" },
  ],
};

const TIER_COLORS = { 0: "#888", 1: "#b0a070", 4: "#818cf8" };

function fmtDate(str) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}

export default function XallePlusScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const c = useTheme();
  const user = useAuthStore(s => s.user);

  const [sub, setSub]           = useState(null);
  const [balance, setBalance]   = useState(0);
  const [loading, setLoading]   = useState(true);
  const [plan, setPlan]         = useState("plus");
  const [months, setMonths]     = useState(1);
  const [buying, setBuying]     = useState(false);

  useEffect(() => {
    Promise.all([
      api("/subscription"),
      api("/iskra/balance"),
    ]).then(([s, b]) => {
      setSub(s);
      setBalance(b?.balance ?? 0);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const cost = calcSparks(plan, months);
  const canAfford = balance >= cost;

  const subscribe = async () => {
    if (!canAfford) {
      Alert.alert("Недостаточно Искры", `Нужно ${cost} ✦, у тебя ${balance} ✦. Купи Искру для подписки.`);
      return;
    }
    Alert.alert(
      `Оформить ${plan === "premium" ? "Premium" : "Plus"}?`,
      `Спишется ${cost} ✦ за ${months} мес.`,
      [
        { text: "Отмена", style: "cancel" },
        { text: "Оформить", onPress: async () => {
          setBuying(true);
          try {
            const res = await api("/iskra/subscribe", { method: "POST", body: { plan, months } });
            setSub(res.subscription);
            setBalance(res.balance);
            haptic.success();
            Alert.alert("Готово! 🎉", `Подписка ${plan === "premium" ? "Premium" : "Plus"} активирована на ${months} мес.`);
          } catch (e) {
            Alert.alert("Ошибка", e.message || "Не удалось оформить подписку");
          } finally { setBuying(false); }
        }},
      ]
    );
  };

  const tierLabel = sub?.active
    ? (sub.tier >= 4 ? "Xalle Premium" : "Xalle Plus")
    : "Базовый";

  const tierColor = sub?.active
    ? (sub.tier >= 4 ? TIER_COLORS[4] : TIER_COLORS[1])
    : TIER_COLORS[0];

  return (
    <View style={[st.root, { backgroundColor: c.BG }]}>
      {/* Header */}
      <View style={[st.header, { paddingTop: insets.top + 6, backgroundColor: c.SURFACE, borderBottomColor: c.LINE }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={st.backBtn} activeOpacity={0.7}>
          <Feather name="arrow-left" size={22} color={c.ACCENT} />
        </TouchableOpacity>
        <Text style={[st.headerTitle, { color: c.INK }]}>Xalle Plus</Text>
        <View style={st.backBtn} />
      </View>

      {loading ? (
        <View style={st.center}><ActivityIndicator color={c.ACCENT} size="large" /></View>
      ) : (
        <ScrollView contentContainerStyle={[st.scroll, { paddingBottom: insets.bottom + 32 }]}>
          {/* Current status */}
          <View style={[st.statusCard, { backgroundColor: c.SURFACE, borderColor: `${tierColor}40` }]}>
            <View style={[st.statusBadge, { backgroundColor: `${tierColor}18` }]}>
              <Text style={[st.statusBadgeText, { color: tierColor }]}>◆ {tierLabel}</Text>
            </View>
            <View style={st.balanceRow}>
              <Text style={[st.balanceLabel, { color: c.INK_SOFT }]}>Баланс Искры</Text>
              <Text style={[st.balanceValue, { color: c.ACCENT }]}>✦ {balance}</Text>
            </View>
            {sub?.active && sub?.expires && (
              <Text style={[st.expiry, { color: c.INK_SOFT }]}>
                Активна до {fmtDate(sub.expires)}
              </Text>
            )}
          </View>

          {/* Plan selector */}
          <Text style={[st.sectionTitle, { color: c.INK }]}>Выбери план</Text>
          <View style={st.planRow}>
            {[
              { id: "plus", label: "Plus", price: `${SPARKS_BASE.plus} ✦/мес`, color: "#b0a070" },
              { id: "premium", label: "Premium", price: `${SPARKS_BASE.premium} ✦/мес`, color: "#818cf8" },
            ].map(p => (
              <TouchableOpacity
                key={p.id}
                style={[st.planCard, { backgroundColor: c.SURFACE, borderColor: plan === p.id ? p.color : c.LINE }, plan === p.id && { borderWidth: 2 }]}
                onPress={() => setPlan(p.id)}
                activeOpacity={0.8}
              >
                <View style={[st.planBadge, { backgroundColor: `${p.color}18` }]}>
                  <Text style={[st.planLabel, { color: p.color }]}>◆ {p.label}</Text>
                </View>
                <Text style={[st.planPrice, { color: c.INK_SOFT }]}>{p.price}</Text>
                {plan === p.id && (
                  <View style={[st.planCheck, { backgroundColor: p.color }]}>
                    <Feather name="check" size={12} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Month selector */}
          <Text style={[st.sectionTitle, { color: c.INK }]}>Срок</Text>
          <View style={st.monthRow}>
            {MONTH_OPTS.map(m => (
              <TouchableOpacity
                key={m}
                style={[st.monthBtn, { backgroundColor: c.SURFACE, borderColor: months === m ? c.ACCENT : c.LINE }, months === m && { borderWidth: 2 }]}
                onPress={() => setMonths(m)}
                activeOpacity={0.8}
              >
                <Text style={[st.monthLabel, { color: months === m ? c.ACCENT : c.INK }]}>
                  {m} {m === 1 ? "мес" : m < 5 ? "мес" : "мес"}
                </Text>
                {DISCOUNT[m] > 0 && (
                  <View style={[st.discountBadge, { backgroundColor: "#34d39918" }]}>
                    <Text style={st.discountText}>-{DISCOUNT[m]}%</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {/* Cost & subscribe */}
          <View style={[st.costCard, { backgroundColor: c.SURFACE, borderColor: c.LINE }]}>
            <View style={st.costRow}>
              <Text style={[st.costLabel, { color: c.INK_SOFT }]}>Итого за {months} мес:</Text>
              <Text style={[st.costValue, { color: c.ACCENT }]}>✦ {cost}</Text>
            </View>
            {DISCOUNT[months] > 0 && (
              <Text style={[st.costSave, { color: "#34d399" }]}>
                Экономия {DISCOUNT[months]}% · без скидки {SPARKS_BASE[plan] * months} ✦
              </Text>
            )}
            <TouchableOpacity
              style={[st.subBtn, { backgroundColor: canAfford ? c.ACCENT : `${c.ACCENT}40` }]}
              onPress={subscribe}
              disabled={buying}
              activeOpacity={0.85}
            >
              {buying
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={st.subBtnText}>
                    {canAfford ? `Оформить за ${cost} ✦` : `Не хватает ✦ (${balance} / ${cost})`}
                  </Text>
              }
            </TouchableOpacity>
          </View>

          {/* Perks */}
          <Text style={[st.sectionTitle, { color: c.INK }]}>Что включено</Text>
          <View style={[st.perksCard, { backgroundColor: c.SURFACE }]}>
            {PERKS[plan].map((perk, i) => (
              <View key={i} style={[st.perkRow, i > 0 && { borderTopColor: c.LINE, borderTopWidth: StyleSheet.hairlineWidth }]}>
                <Text style={st.perkIcon}>{perk.icon}</Text>
                <View style={st.perkInfo}>
                  <Text style={[st.perkTitle, { color: c.INK }]}>{perk.title}</Text>
                  <Text style={[st.perkDesc, { color: c.INK_SOFT }]}>{perk.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const st = StyleSheet.create({
  root:           { flex: 1 },
  header:         { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn:        { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle:    { fontSize: 17, fontWeight: "800" },
  center:         { flex: 1, alignItems: "center", justifyContent: "center" },
  scroll:         { padding: 16, gap: 16 },
  sectionTitle:   { fontSize: 15, fontWeight: "800", marginBottom: -8 },

  statusCard:     { borderRadius: 18, padding: 16, borderWidth: 1.5, gap: 10 },
  statusBadge:    { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12 },
  statusBadgeText:{ fontSize: 14, fontWeight: "800" },
  balanceRow:     { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  balanceLabel:   { fontSize: 14 },
  balanceValue:   { fontSize: 20, fontWeight: "800" },
  expiry:         { fontSize: 12.5, fontStyle: "italic" },

  planRow:        { flexDirection: "row", gap: 12 },
  planCard:       { flex: 1, borderRadius: 16, padding: 14, borderWidth: 1, gap: 8, position: "relative" },
  planBadge:      { alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  planLabel:      { fontSize: 14, fontWeight: "800" },
  planPrice:      { fontSize: 12 },
  planCheck:      { position: "absolute", top: 10, right: 10, width: 20, height: 20, borderRadius: 10, alignItems: "center", justifyContent: "center" },

  monthRow:       { flexDirection: "row", gap: 8 },
  monthBtn:       { flex: 1, alignItems: "center", paddingVertical: 11, borderRadius: 12, borderWidth: 1, gap: 4 },
  monthLabel:     { fontSize: 13.5, fontWeight: "700" },
  discountBadge:  { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 8 },
  discountText:   { fontSize: 10, fontWeight: "800", color: "#34d399" },

  costCard:       { borderRadius: 18, padding: 16, borderWidth: StyleSheet.hairlineWidth, gap: 10 },
  costRow:        { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  costLabel:      { fontSize: 14 },
  costValue:      { fontSize: 22, fontWeight: "800" },
  costSave:       { fontSize: 12.5, fontStyle: "italic" },
  subBtn:         { alignItems: "center", paddingVertical: 14, borderRadius: 14 },
  subBtnText:     { color: "#fff", fontSize: 15, fontWeight: "800" },

  perksCard:      { borderRadius: 18, overflow: "hidden" },
  perkRow:        { flexDirection: "row", alignItems: "flex-start", gap: 12, padding: 14 },
  perkIcon:       { fontSize: 22, width: 30, textAlign: "center" },
  perkInfo:       { flex: 1, gap: 2 },
  perkTitle:      { fontSize: 14, fontWeight: "700" },
  perkDesc:       { fontSize: 12.5, lineHeight: 18 },
});
