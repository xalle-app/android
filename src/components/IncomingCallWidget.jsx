import { useEffect, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import Feather from "@expo/vector-icons/Feather";
import Avatar from "./Avatar.jsx";
import { useCallStore } from "../store/call.js";
import { wsOn } from "../lib/ws.js";
import { haptic } from "../lib/haptics.js";
import { useTheme } from "../store/theme.js";

export default function IncomingCallWidget() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const c = useTheme();
  const incomingCall = useCallStore(s => s.incomingCall);
  const setIncomingCall = useCallStore(s => s.setIncomingCall);
  const clearIncomingCall = useCallStore(s => s.clearIncomingCall);

  const slideY = useRef(new Animated.Value(-120)).current;

  // Listen for incoming call WS events
  useEffect(() => {
    const off = wsOn("vcall:incoming", (m) => {
      haptic.medium();
      setIncomingCall({
        fromId: m.fromId,
        fromName: m.fromName,
        fromHandle: m.fromHandle,
        fromAvatar: m.fromAvatar,
        code: m.code,
      });
    });
    return off;
  }, [setIncomingCall]);

  // Animate in/out when incomingCall changes
  useEffect(() => {
    Animated.spring(slideY, {
      toValue: incomingCall ? 0 : -120,
      useNativeDriver: true,
      tension: 85,
      friction: 11,
    }).start();
  }, [!!incomingCall]);

  // Auto-dismiss after 30s
  useEffect(() => {
    if (!incomingCall) return;
    const t = setTimeout(() => clearIncomingCall(), 30000);
    return () => clearTimeout(t);
  }, [incomingCall]);

  const accept = () => {
    haptic.success();
    const call = incomingCall;
    clearIncomingCall();
    navigation.navigate("VoiceCall", {
      callCode: call.code,
      isOutgoing: false,
      conv: {
        other_id: call.fromId,
        other_name: call.fromName,
        other_handle: call.fromHandle,
        other_avatar: call.fromAvatar,
      },
    });
  };

  const decline = () => {
    haptic.light();
    clearIncomingCall();
  };

  return (
    <Animated.View
      style={[st.banner, { top: insets.top + 8, transform: [{ translateY: slideY }] }]}
      pointerEvents={incomingCall ? "box-none" : "none"}
    >
      <View style={[st.content, { backgroundColor: c.SURFACE, borderColor: c.LINE }]}>
        <Avatar url={incomingCall?.fromAvatar} name={incomingCall?.fromName || "?"} size={38} />
        <View style={st.info}>
          <Text style={[st.title, { color: c.INK }]} numberOfLines={1}>{incomingCall?.fromName || "—"}</Text>
          <Text style={[st.sub, { color: c.INK_SOFT }]}>Входящий звонок</Text>
        </View>
        <TouchableOpacity style={st.declineBtn} onPress={decline} activeOpacity={0.8}>
          <Feather name="phone-off" size={18} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={st.acceptBtn} onPress={accept} activeOpacity={0.8}>
          <Feather name="phone" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const st = StyleSheet.create({
  banner:     { position: "absolute", left: 12, right: 12, zIndex: 9999 },
  content:    { borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 12, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 4 }, elevation: 10, borderWidth: 1 },
  info:       { flex: 1 },
  title:      { fontSize: 15, fontWeight: "700" },
  sub:        { fontSize: 12, marginTop: 1 },
  declineBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#e05a5a", alignItems: "center", justifyContent: "center" },
  acceptBtn:  { width: 40, height: 40, borderRadius: 20, backgroundColor: "#3db87a", alignItems: "center", justifyContent: "center" },
});
