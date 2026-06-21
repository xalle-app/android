import { View, Text, Image, StyleSheet } from "react-native";
import { assetUrl } from "../lib/api.js";
import { initials } from "../lib/format.js";
import { useTheme } from "../store/theme.js";

export default function Avatar({ url, name, size = 36 }) {
  const c = useTheme();
  const src = assetUrl(url);
  const style = { width: size, height: size, borderRadius: size / 2 };

  if (src) {
    return <Image source={{ uri: src }} style={[st.img, style]} />;
  }

  const fontSize = Math.floor(size * 0.38);
  return (
    <View style={[st.placeholder, style, { backgroundColor: c.WARM }]}>
      <Text style={[st.initials, { fontSize, color: c.ACCENT }]}>
        {initials(name)}
      </Text>
    </View>
  );
}

const st = StyleSheet.create({
  img:         { resizeMode: "cover" },
  placeholder: { alignItems: "center", justifyContent: "center" },
  initials:    { fontWeight: "700" },
});
