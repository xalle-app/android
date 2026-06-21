import { useEffect, useRef, useState, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert, NativeModules, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import Avatar from "../components/Avatar.jsx";
import { useAuthStore } from "../store/auth.js";
import { useCallStore } from "../store/call.js";
import { useVoiceCall } from "../lib/useVoiceCall.js";
import { wsOn } from "../lib/ws.js";
import { haptic } from "../lib/haptics.js";
import { useTheme } from "../store/theme.js";

const BG_CALL = "#1a1210";
const BG_CARD = "#2a2018";
const WHITE   = "#f0ebe4";

// Toggle Android loudspeaker via react-native-webrtc's AudioManager
function setSpeaker(on) {
  try {
    const lib = require("react-native-webrtc");
    if (lib?.AudioManager?.setSpeakerphoneOn) {
      lib.AudioManager.setSpeakerphoneOn(on);
      return;
    }
    // Fallback: Android NativeModules
    if (Platform.OS === "android" && NativeModules.AudioModule?.setSpeakerphoneOn) {
      NativeModules.AudioModule.setSpeakerphoneOn(on);
    }
  } catch {}
}

function CallTimer({ running }) {
  const c = useTheme();
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!running) { setSecs(0); return; }
    const t = setInterval(() => setSecs(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  const m = String(Math.floor(secs / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return <Text style={[st.timerText, { color: c.ACCENT }]}>{m}:{s}</Text>;
}

export default function VoiceCallScreen({ navigation, route }) {
  const { conv, callCode: initialCode, isOutgoing } = route.params || {};
  const me             = useAuthStore(s => s.user);
  const insets         = useSafeAreaInsets();
  const c              = useTheme();
  const setActiveCall  = useCallStore(s => s.setActiveCall);
  const clearActiveCall = useCallStore(s => s.clearActiveCall);
  const clearIncomingCall = useCallStore(s => s.clearIncomingCall);

  const { active, muted, callCode, members, peers, startCall, joinCall, leaveCall, toggleMute } =
    useVoiceCall(me?.id);

  const [status, setStatus]   = useState(isOutgoing ? "calling" : "connecting");
  const [peerInfo, setPeerInfo] = useState(null);
  const [speaker, setSpeakerState] = useState(true);
  const hungUpRef = useRef(false);

  // ── Peer info from conv params or members ─────────────────────────────────
  useEffect(() => {
    if (conv) setPeerInfo({ name: conv.other_name || conv.title, handle: conv.other_handle, avatar: conv.other_avatar || conv.avatar_url });
  }, [conv]);

  useEffect(() => {
    if (!members?.length) return;
    const other = members.find(m => m.id !== me?.id);
    if (other) setPeerInfo({ name: other.name, handle: other.handle, avatar: other.avatar });
  }, [members, me?.id]);

  // ── Init call on mount ────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      let result;
      if (isOutgoing) {
        if (!conv?.other_id) {
          Alert.alert("Ошибка", "Не удалось определить собеседника");
          navigation.goBack();
          return;
        }
        // Pass other_id so the hook sends vcall:invite after room is created
        result = await startCall(conv.other_id);
      } else {
        result = await joinCall(initialCode);
      }
      if (!mounted) return;
      if (result?.error) {
        const msg =
          result.error === "mic_denied"      ? "Нет доступа к микрофону." :
          result.error === "mic_unavailable" ? "Микрофон недоступен (нужен EAS Build)." :
          "Не удалось начать звонок.";
        Alert.alert("Ошибка", msg, [{ text: "OK", onPress: () => navigation.goBack() }]);
      }
    };
    init();
    return () => { mounted = false; };
  }, []); // run once

  // ── Status tracking ────────────────────────────────────────────────────────
  useEffect(() => {
    if (active && peers.length > 0) setStatus("connected");
    else if (active && peers.length === 0 && status === "connected") setStatus("calling");
  }, [active, peers.length]);

  useEffect(() => {
    const off = wsOn("vcall:user-left", () => {
      if (peers.length <= 1) setStatus("ended");
    });
    return off;
  }, [peers.length]);

  useEffect(() => {
    if (status !== "ended") return;
    const t = setTimeout(() => hangUp(), 1800);
    return () => clearTimeout(t);
  }, [status]);

  // ── Register active call in store ──────────────────────────────────────────
  useEffect(() => {
    if (active && callCode) setActiveCall({ code: callCode });
  }, [active, callCode]);

  // ── Speaker toggle ─────────────────────────────────────────────────────────
  const toggleSpeaker = useCallback(() => {
    const next = !speaker;
    setSpeakerState(next);
    setSpeaker(next);
    haptic.select();
  }, [speaker]);

  const hangUp = useCallback(() => {
    if (hungUpRef.current) return;
    hungUpRef.current = true;
    haptic.medium();
    setSpeaker(false);
    leaveCall();
    clearActiveCall();
    clearIncomingCall();
    navigation.goBack();
  }, [leaveCall, clearActiveCall, clearIncomingCall, navigation]);

  const statusText =
    status === "calling"    ? (isOutgoing ? "Звоним..." : "Подключение...") :
    status === "connected"  ? "Соединено" :
    "Звонок завершён";

  return (
    <View style={[st.root, { paddingTop: insets.top }]}>
      <View style={st.header}>
        <Text style={st.headerTitle}>
          {isOutgoing ? "Исходящий звонок" : "Входящий звонок"}
        </Text>
      </View>

      <View style={st.centerBlock}>
        <View style={[st.avatarRing, status === "connected" && { borderColor: c.ACCENT }]}>
          <Avatar url={peerInfo?.avatar} name={peerInfo?.name || "?"} size={96} />
        </View>
        <Text style={st.peerName}>{peerInfo?.name || "—"}</Text>
        {peerInfo?.handle && <Text style={st.peerHandle}>@{peerInfo.handle}</Text>}
        <Text style={st.statusText}>{statusText}</Text>
        <CallTimer running={status === "connected"} />
      </View>

      <View style={[st.controls, { paddingBottom: insets.bottom + 24 }]}>
        {/* Mute */}
        <TouchableOpacity
          style={[st.ctrlBtn, muted && st.ctrlBtnActive]}
          onPress={() => { haptic.select(); toggleMute(); }}
          activeOpacity={0.8}
        >
          <Feather name={muted ? "mic-off" : "mic"} size={24} color={muted ? c.ACCENT : WHITE} />
          <Text style={[st.ctrlLabel, muted && { color: c.ACCENT }]}>
            {muted ? "Вкл. микрофон" : "Микрофон"}
          </Text>
        </TouchableOpacity>

        {/* Hang up */}
        <TouchableOpacity style={st.hangBtn} onPress={hangUp} activeOpacity={0.85}>
          <Feather name="phone-off" size={28} color="#fff" />
        </TouchableOpacity>

        {/* Speaker */}
        <TouchableOpacity
          style={[st.ctrlBtn, speaker && st.ctrlBtnActive]}
          onPress={toggleSpeaker}
          activeOpacity={0.8}
        >
          <Feather name={speaker ? "volume-2" : "headphones"} size={24} color={speaker ? c.ACCENT : WHITE} />
          <Text style={[st.ctrlLabel, speaker && { color: c.ACCENT }]}>
            {speaker ? "Громкая связь" : "Динамик"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  root:             { flex: 1, backgroundColor: BG_CALL, alignItems: "stretch" },
  header:           { paddingHorizontal: 20, paddingVertical: 12, alignItems: "center" },
  headerTitle:      { color: WHITE, fontSize: 15, fontWeight: "600", opacity: 0.7 },

  centerBlock:      { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  avatarRing:       { borderRadius: 64, padding: 5, borderWidth: 2, borderColor: "transparent", marginBottom: 4 },
  peerName:         { color: WHITE, fontSize: 22, fontWeight: "800", marginTop: 4 },
  peerHandle:       { color: "#7a7068", fontSize: 14 },
  statusText:       { color: "#7a7068", fontSize: 14, marginTop: 6 },
  timerText:        { fontSize: 18, fontWeight: "700", letterSpacing: 1, marginTop: 2 },

  controls:         { flexDirection: "row", alignItems: "center", justifyContent: "space-around", paddingHorizontal: 32, paddingTop: 16 },
  ctrlBtn:          { alignItems: "center", gap: 6, backgroundColor: BG_CARD, borderRadius: 20, paddingVertical: 14, paddingHorizontal: 18 },
  ctrlBtnActive:    { backgroundColor: "#3a2a22" },
  ctrlLabel:        { color: WHITE, fontSize: 12, opacity: 0.8 },
  hangBtn:          { width: 68, height: 68, borderRadius: 34, backgroundColor: "#e05a5a", alignItems: "center", justifyContent: "center", shadowColor: "#e05a5a", shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 8 },
});
