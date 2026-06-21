import { memo } from "react";
import { View, Text, StyleSheet } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import MaterialCommunityIcons from "@expo/vector-icons/MaterialCommunityIcons";
import { useTheme } from "../store/theme.js";

const TIERS = {
  1: { symbol: "✦",     color: "#b0a070" },
  2: { symbol: "✦✦",   color: "#c8a84b" },
  3: { symbol: "✦✦✦", color: "#e0b84d" },
  4: { symbol: "✦",     color: "#818cf8" },
};

// Parse CSS gradient → first and last hex color
function parseGradientColors(gradient) {
  if (!gradient) return null;
  const hits = gradient.match(/#[0-9a-fA-F]{3,8}/g);
  return hits?.length >= 2 ? hits : null;
}

function VerifiedBadge() {
  return (
    <View style={st.verifiedWrap}>
      <Feather name="check" size={8} color="#fff" />
    </View>
  );
}

function ModBadge() {
  return <MaterialCommunityIcons name="ghost" size={15} color="#9b59b6" style={st.icon} />;
}

function SubBadge({ tier }) {
  const cfg = TIERS[tier];
  if (!cfg) return null;
  const isPremium = tier === 4;
  return (
    <Text style={[st.subSymbol, { color: cfg.color }, isPremium && st.premiumGlow]}>
      {cfg.symbol}
    </Text>
  );
}

function UserName({
  name,
  verified,
  role,
  nameColor,
  nameGradient,
  subTier,
  style,
  containerStyle,
  numberOfLines = 1,
}) {
  const c = useTheme();
  const isMod = role === "moderator";
  const gradColors = parseGradientColors(nameGradient);

  // Gradient text: use first gradient color as text color (true gradient text needs Skia/SVG)
  // This matches the intent — colored name — without background pill
  const textColor = gradColors
    ? gradColors[0]
    : nameColor || (isMod ? "#9b59b6" : c.INK);

  return (
    <View style={[st.row, containerStyle]}>
      <Text
        style={[st.name, style, { color: textColor }]}
        numberOfLines={numberOfLines}
      >
        {name}
      </Text>

      {isMod
        ? <ModBadge />
        : verified
          ? <VerifiedBadge />
          : null
      }

      {subTier > 0 && <SubBadge tier={subTier} />}
    </View>
  );
}

export default memo(UserName);

const st = StyleSheet.create({
  row:          { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1, maxWidth: "100%" },
  name:         { fontSize: 14.5, fontWeight: "700", flexShrink: 1 },
  icon:         { marginTop: 1 },
  verifiedWrap: { width: 15, height: 15, borderRadius: 8, backgroundColor: "#4a9eff", alignItems: "center", justifyContent: "center" },
  subSymbol:    { fontSize: 11, fontWeight: "800", letterSpacing: -1 },
  premiumGlow:  { textShadowColor: "#818cf8", textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 6 },
});
