import { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, StyleSheet, TextInput } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useTheme } from "../store/theme.js";

const CATEGORIES = [
  {
    label: "😊", emojis: [
      "😀","😁","😂","🤣","😃","😄","😅","😆","😇","😈","😉","😊","😋","😌","😍","🥰",
      "😎","😏","😐","😑","😒","😓","😔","😕","🙃","🤑","🤗","🤔","🤐","😶","😬","🙄",
      "😯","😦","😧","😮","😲","🥱","😴","🤤","😪","😵","🤯","🤠","🥳","🤡","🤥","🤫",
    ]
  },
  {
    label: "❤️", emojis: [
      "❤️","🧡","💛","💚","💙","💜","🖤","🤍","🤎","💔","❣️","💕","💞","💓","💗","💖",
      "💘","💝","💟","🫶","👍","👎","👏","🙌","🤝","🫂","💪","🔥","✨","⭐","🌟","💫",
    ]
  },
  {
    label: "🐱", emojis: [
      "🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷","🐸","🐵","🙈",
      "🙉","🙊","🐔","🐧","🐦","🦆","🦅","🦉","🦇","🐺","🐗","🦄","🐝","🐛","🦋","🐌",
    ]
  },
  {
    label: "🍕", emojis: [
      "🍎","🍊","🍋","🍇","🍓","🍈","🍒","🍑","🥭","🍍","🥥","🥝","🍅","🍆","🥑","🌽",
      "🍕","🍔","🌮","🌯","🥗","🍜","🍣","🍦","🍩","🎂","☕","🍺","🥂","🍾","🥃","🧃",
    ]
  },
  {
    label: "⚽", emojis: [
      "⚽","🏀","🏈","⚾","🎾","🏐","🏉","🎱","🏓","🏸","🥊","🎯","⛳","🎮","🎲","♟️",
      "🏆","🥇","🎭","🎨","🎬","🎤","🎵","🎶","🎸","🥁","🎹","🎺","🎻","🎷","🎙️","📱",
    ]
  },
  {
    label: "🚀", emojis: [
      "🚀","✈️","🚂","🚗","🏎️","🚕","🚙","🛻","🚌","🚎","🏍️","🛵","🚲","🛴","🛹","🚁",
      "⛵","🚤","🛸","🌍","🌙","☀️","⛅","🌈","❄️","⚡","🌊","🏔️","🌋","🏝️","🌅","🌆",
    ]
  },
];

const COLS = 8;
const EMOJI_SIZE = 38;

export default function EmojiPicker({ onSelect, onClose }) {
  const c = useTheme();
  const [catIdx, setCatIdx] = useState(0);
  const [search, setSearch] = useState("");

  const category = CATEGORIES[catIdx];
  const emojis = search ? CATEGORIES.flatMap(cat => cat.emojis).slice(0, 48) : category.emojis;

  return (
    <View style={[st.root, { backgroundColor: c.SURFACE, borderTopColor: c.LINE }]}>
      <View style={st.topRow}>
        <View style={[st.searchWrap, { backgroundColor: c.WARM }]}>
          <Feather name="search" size={14} color={c.INK_SOFT} style={{ marginRight: 5 }} />
          <TextInput
            style={[st.searchInput, { color: c.INK }]}
            placeholder="Поиск..."
            placeholderTextColor={c.INK_SOFT}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
        <TouchableOpacity onPress={onClose} style={st.closeBtn} activeOpacity={0.7}>
          <Feather name="x" size={18} color={c.INK_SOFT} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.cats} contentContainerStyle={st.catsInner}>
        {CATEGORIES.map((cat, i) => (
          <TouchableOpacity
            key={i}
            style={[st.catBtn, { backgroundColor: c.WARM }, catIdx === i && { backgroundColor: `${c.ACCENT}20`, borderWidth: 1, borderColor: `${c.ACCENT}40` }]}
            onPress={() => { setCatIdx(i); setSearch(""); }}
            activeOpacity={0.7}
          >
            <Text style={st.catEmoji}>{cat.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={st.grid} showsVerticalScrollIndicator={false}>
        <View style={st.gridInner}>
          {emojis.map((emoji, i) => (
            <TouchableOpacity key={i} style={st.emojiBtn} onPress={() => onSelect(emoji)} activeOpacity={0.6}>
              <Text style={st.emoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  root:        { borderTopWidth: 1, paddingTop: 8 },
  topRow:      { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, gap: 8, marginBottom: 6 },
  searchWrap:  { flex: 1, flexDirection: "row", alignItems: "center", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  searchInput: { flex: 1, fontSize: 13, padding: 0 },
  closeBtn:    { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  cats:        { maxHeight: 44 },
  catsInner:   { flexDirection: "row", paddingHorizontal: 8, gap: 4, alignItems: "center" },
  catBtn:      { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  catEmoji:    { fontSize: 20 },
  grid:        { maxHeight: 180 },
  gridInner:   { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 6, paddingVertical: 4 },
  emojiBtn:    { width: `${100 / COLS}%`, height: EMOJI_SIZE, alignItems: "center", justifyContent: "center" },
  emoji:       { fontSize: 24 },
});
