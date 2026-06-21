import { useState, useRef, useCallback } from "react";
import {
  Modal, View, Text, TouchableOpacity, FlatList, Image,
  StyleSheet, Dimensions, StatusBar, Animated, PanResponder,
} from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { assetUrl } from "../lib/api.js";

const { width: W, height: H } = Dimensions.get("window");

function LightboxSlide({ uri }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <View style={sl.slide}>
      <Animated.Image
        source={{ uri }}
        style={[sl.img, { transform: [{ scale }] }]}
        resizeMode="contain"
      />
    </View>
  );
}

export default function Lightbox({ images, initialIndex = 0, visible, onClose }) {
  const [idx, setIdx] = useState(initialIndex);
  const listRef = useRef(null);

  const urls = (images || []).map(img =>
    typeof img === "string" ? assetUrl(img) : assetUrl(img?.url || img)
  ).filter(Boolean);

  const handleViewable = useCallback(({ viewableItems }) => {
    if (viewableItems.length > 0) setIdx(viewableItems[0].index ?? 0);
  }, []);

  if (!visible || !urls.length) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <StatusBar hidden />
      <View style={sl.bg}>
        <FlatList
          ref={listRef}
          data={urls}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item }) => <LightboxSlide uri={item} />}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, index) => ({ length: W, offset: W * index, index })}
          onViewableItemsChanged={handleViewable}
          viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
        />

        {/* Close button */}
        <TouchableOpacity style={sl.closeBtn} onPress={onClose} activeOpacity={0.8} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <View style={sl.closePill}>
            <Feather name="x" size={20} color="#fff" />
          </View>
        </TouchableOpacity>

        {/* Counter */}
        {urls.length > 1 && (
          <View style={sl.counter}>
            <Text style={sl.counterText}>{idx + 1} / {urls.length}</Text>
          </View>
        )}

        {/* Dots */}
        {urls.length > 1 && (
          <View style={sl.dots}>
            {urls.map((_, i) => (
              <View key={i} style={[sl.dot, i === idx && sl.dotActive]} />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

const sl = StyleSheet.create({
  bg:          { flex: 1, backgroundColor: "#000" },
  slide:       { width: W, height: H, alignItems: "center", justifyContent: "center" },
  img:         { width: W, height: H * 0.85 },
  closeBtn:    { position: "absolute", top: 52, right: 16, zIndex: 10 },
  closePill:   { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  counter:     { position: "absolute", top: 56, left: 0, right: 0, alignItems: "center" },
  counterText: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontWeight: "600" },
  dots:        { position: "absolute", bottom: 40, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot:         { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.35)" },
  dotActive:   { backgroundColor: "#fff", width: 18 },
});
