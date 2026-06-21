import { View, Text, TouchableOpacity, StyleSheet, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { usePlayerStore } from "../store/player.js";
import { globalPlayer } from "../lib/globalPlayer.js";
import { assetUrl } from "../lib/api.js";
import { useTheme } from "../store/theme.js";

export default function GlobalPlayerBar() {
  const c       = useTheme();
  const insets  = useSafeAreaInsets();
  const track   = usePlayerStore(s => s.track);
  const isPlaying = usePlayerStore(s => s.isPlaying);
  const position  = usePlayerStore(s => s.position);
  const duration  = usePlayerStore(s => s.duration);

  if (!track) return null;

  const pct = duration > 0 ? Math.min(position / duration, 1) : 0;
  // Sit just above the bottom tab bar (62px) + safe area
  const bottomOffset = insets.bottom + 62;

  return (
    <View style={[st.bar, { backgroundColor: c.SURFACE, borderTopColor: c.LINE, bottom: bottomOffset }]}>
      {/* Progress line at top */}
      <View style={[st.progressTrack, { backgroundColor: c.LINE }]}>
        <View style={[st.progressFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: c.ACCENT }]} />
      </View>

      <View style={st.row}>
        {track.coverUrl
          ? <Image source={{ uri: assetUrl(track.coverUrl) }} style={st.cover} />
          : (
            <View style={[st.cover, { backgroundColor: `${c.ACCENT}20`, alignItems: "center", justifyContent: "center" }]}>
              <Feather name="music" size={18} color={c.ACCENT} />
            </View>
          )
        }
        <View style={st.info}>
          <Text style={[st.title, { color: c.INK }]} numberOfLines={1}>{track.title}</Text>
          <Text style={[st.artist, { color: c.INK_SOFT }]} numberOfLines={1}>
            {track.artist || track.uploaderName || ""}
          </Text>
        </View>
        <TouchableOpacity style={st.btn} onPress={() => globalPlayer.toggle()} activeOpacity={0.7}>
          <Feather name={isPlaying ? "pause" : "play"} size={22} color={c.ACCENT} />
        </TouchableOpacity>
        <TouchableOpacity style={st.btn} onPress={() => globalPlayer.stop()} activeOpacity={0.7}>
          <Feather name="x" size={18} color={c.INK_SOFT} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  bar:          { position: "absolute", left: 0, right: 0, borderTopWidth: StyleSheet.hairlineWidth, zIndex: 900 },
  progressTrack:{ height: 2 },
  progressFill: { height: 2 },
  row:          { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 9 },
  cover:        { width: 40, height: 40, borderRadius: 8 },
  info:         { flex: 1, gap: 1 },
  title:        { fontSize: 14, fontWeight: "700" },
  artist:       { fontSize: 12 },
  btn:          { padding: 6 },
});
