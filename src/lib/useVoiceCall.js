import { useEffect, useRef, useState, useCallback } from "react";
import { ws, wsOn } from "./ws.js";

// ── react-native-webrtc lazy load ──────────────────────────────────────────
let _lib = null;
let _globalsRegistered = false;

function getLib() {
  if (!_lib) {
    try { _lib = require("react-native-webrtc"); } catch { return null; }
  }
  // registerGlobals() must be called once so RTCPeerConnection etc. are available
  if (!_globalsRegistered && _lib?.registerGlobals) {
    try { _lib.registerGlobals(); _globalsRegistered = true; } catch {}
  }
  return _lib;
}

let _inCall = "unset";
function getInCallManager() {
  if (_inCall === "unset") {
    try {
      const m = require("react-native-incall-manager").default;
      _inCall = (m && typeof m.start === "function") ? m : null;
    } catch { _inCall = null; }
  }
  return _inCall;
}

function activateAudio() {
  try {
    const ICM = getInCallManager();
    if (ICM) {
      ICM.start({ media: "audio", auto: true, ringback: "" });
      ICM.setForceSpeakerphoneOn(true);
    } else {
      console.warn("[vcall] InCallManager not available — rebuild with EAS");
    }
  } catch (e) { console.warn("[vcall] activateAudio error:", e); }
}

function deactivateAudio() {
  try {
    const ICM = getInCallManager();
    if (ICM) ICM.stop();
  } catch {}
}

export function setAudioSpeaker(on) {
  try {
    const ICM = getInCallManager();
    if (ICM) ICM.setForceSpeakerphoneOn(on);
  } catch {}
}

// ── Config ─────────────────────────────────────────────────────────────────
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "turns:xalle.emris-host.ru:5349",          username: "xalle", credential: "turn_secret_2024" },
  { urls: "turn:xalle.emris-host.ru:3478?transport=tcp", username: "xalle", credential: "turn_secret_2024" },
  { urls: "turn:93.185.159.89:3478",                 username: "xalle", credential: "turn_secret_2024" },
];

const AUDIO_CONSTRAINTS = {
  audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  video: false,
};

function sendWs(payload) { ws.send(payload); }

// ── Hook ───────────────────────────────────────────────────────────────────
export function useVoiceCall(myUserId) {
  const [state, setState] = useState({
    active: false, muted: false, callCode: null, members: [], peers: [],
  });

  const pcsRef           = useRef(new Map()); // userId → RTCPeerConnection
  const iceCacheRef      = useRef(new Map()); // userId → [RTCIceCandidate] queued before remoteDesc
  const remoteStreamsRef = useRef(new Map()); // userId → MediaStream (keep alive to prevent GC)
  const streamRef        = useRef(null);
  const activeRef        = useRef(false);
  const muteRef          = useRef(false);
  const pendingTargetRef = useRef(null); // targetId to invite after vcall:created

  // ── helpers ──────────────────────────────────────────────────────────────

  const cleanupPeer = useCallback((userId) => {
    const pc = pcsRef.current.get(userId);
    if (pc) { try { pc.close(); } catch {} pcsRef.current.delete(userId); }
    iceCacheRef.current.delete(userId);
    const rs = remoteStreamsRef.current.get(userId);
    if (rs) { try { rs.getTracks().forEach(t => t.stop()); } catch {} remoteStreamsRef.current.delete(userId); }
    setState(s => ({ ...s, peers: s.peers.filter(id => id !== userId) }));
  }, []);

  /** Flush queued ICE candidates for a peer after remote description is set */
  const flushIceQueue = useCallback(async (peerId, pc) => {
    const lib = getLib();
    if (!lib) return;
    const { RTCIceCandidate } = lib;
    const queue = iceCacheRef.current.get(peerId) || [];
    iceCacheRef.current.set(peerId, []);
    for (const candidate of queue) {
      try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
    }
  }, []);

  const createPeer = useCallback((targetId, isOfferer) => {
    if (pcsRef.current.has(targetId)) return pcsRef.current.get(targetId);
    const lib = getLib();
    if (!lib) return null;
    const { RTCPeerConnection } = lib;

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    pcsRef.current.set(targetId, pc);

    // Preserve any ICE candidates that arrived before the PC was created
    if (!iceCacheRef.current.has(targetId)) iceCacheRef.current.set(targetId, []);

    // Add local tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => pc.addTrack(track, streamRef.current));
    }

    // ICE candidate ready → send to remote
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        console.log(`[vcall] ICE candidate type=${e.candidate.type} proto=${e.candidate.protocol}`);
        sendWs({ type: "vcall:ice", targetId, candidate: e.candidate });
      } else {
        console.log("[vcall] ICE gathering complete");
      }
    };

    // Remote track received — keep stream ref alive to prevent GC
    pc.ontrack = (e) => {
      if (e.track) e.track.enabled = true;
      if (e.streams?.[0]) remoteStreamsRef.current.set(targetId, e.streams[0]);
    };

    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      console.log(`[vcall] peer ${targetId} connection: ${s}`);
      if (s === "failed" || s === "closed") cleanupPeer(targetId);
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`[vcall] peer ${targetId} ICE: ${pc.iceConnectionState}`);
    };

    if (isOfferer) {
      // Small delay so both sides finish setup before negotiation starts
      setTimeout(async () => {
        try {
          const offer = await pc.createOffer({ offerToReceiveAudio: true });
          await pc.setLocalDescription(offer);
          sendWs({ type: "vcall:offer", targetId, sdp: pc.localDescription });
        } catch (err) { console.warn("[vcall] createOffer failed:", err); }
      }, 150);
    }

    return pc;
  }, [cleanupPeer]);

  // ── Mic stream ───────────────────────────────────────────────────────────

  const getMicStream = async () => {
    const lib = getLib();
    if (!lib) throw Object.assign(new Error("WebRTC unavailable"), { name: "NotSupportedError" });

    // Явно запрашиваем разрешение на микрофон (обязательно для release-сборки)
    try {
      const { Audio } = require("expo-av");
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") throw Object.assign(new Error("mic denied"), { name: "NotAllowedError" });
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
      });
    } catch (e) {
      if (e.name === "NotAllowedError") throw e;
    }

    return lib.mediaDevices.getUserMedia(AUDIO_CONSTRAINTS);
  };

  // ── Public API ───────────────────────────────────────────────────────────

  /** Start outgoing call. targetId = userId of the person to call. */
  const startCall = useCallback(async (targetId) => {
    if (activeRef.current) return null;
    try {
      // Останавливаем музыку перед звонком чтобы не конфликтовать за audio focus
      try { require("../lib/globalPlayer.js").globalPlayer.stop(); } catch {}
      activateAudio(); // активируем audio mode ДО getUserMedia на Android
      const stream = await getMicStream();
      streamRef.current = stream;
      muteRef.current = false;
      pendingTargetRef.current = targetId ?? null;
      sendWs({ type: "vcall:create" });
      return true;
    } catch (err) {
      deactivateAudio();
      const code = err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
        ? "mic_denied"
        : err.name === "NotSupportedError" ? "mic_unavailable" : "mic_error";
      return { error: code };
    }
  }, []);

  /** Join incoming call by room code. */
  const joinCall = useCallback(async (code) => {
    if (activeRef.current) return null;
    try {
      try { require("../lib/globalPlayer.js").globalPlayer.stop(); } catch {}
      activateAudio(); // активируем audio mode ДО getUserMedia на Android
      const stream = await getMicStream();
      streamRef.current = stream;
      muteRef.current = false;
      sendWs({ type: "vcall:join", code });
      return true;
    } catch (err) {
      deactivateAudio();
      const errCode = err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
        ? "mic_denied"
        : err.name === "NotSupportedError" ? "mic_unavailable" : "mic_error";
      return { error: errCode };
    }
  }, []);

  const leaveCall = useCallback(() => {
    if (!activeRef.current) return;
    sendWs({ type: "vcall:leave" });
    for (const [uid] of [...pcsRef.current]) cleanupPeer(uid);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    remoteStreamsRef.current.clear();
    deactivateAudio();
    activeRef.current = false;
    muteRef.current = false;
    pendingTargetRef.current = null;
    setState({ active: false, muted: false, callCode: null, members: [], peers: [] });
  }, [cleanupPeer]);

  const toggleMute = useCallback(() => {
    if (!streamRef.current) return;
    const next = !muteRef.current;
    muteRef.current = next;
    streamRef.current.getAudioTracks().forEach(t => { t.enabled = !next; });
    setState(s => ({ ...s, muted: next }));
  }, []);

  // ── WebSocket event handlers ──────────────────────────────────────────────
  useEffect(() => {
    const lib = getLib();
    const RTCSessionDescription = lib?.RTCSessionDescription;
    const RTCIceCandidate       = lib?.RTCIceCandidate;

    // Room created (outgoing) — send invite to target
    const offCreated = wsOn("vcall:created", (m) => {
      activeRef.current = true;
      const peers = m.peers || [];
      setState(s => ({ ...s, active: true, callCode: m.code, members: m.members || [], peers }));

      // Invite the person we're calling
      if (pendingTargetRef.current) {
        sendWs({ type: "vcall:invite", targetId: pendingTargetRef.current, code: m.code });
        pendingTargetRef.current = null;
      }

      for (const peerId of peers) {
        if (peerId !== myUserId) createPeer(peerId, true);
      }
    });

    // Joined room (incoming) — initiate negotiation with each existing peer
    const offJoined = wsOn("vcall:joined", (m) => {
      activeRef.current = true;
      const peers = m.peers || [];
      setState(s => ({ ...s, active: true, callCode: m.code, members: m.members || [], peers }));
      for (const peerId of peers) {
        if (peerId !== myUserId) createPeer(peerId, true); // we are the joiner → we offer
      }
    });

    // Another user joined our existing room
    const offUserJoined = wsOn("vcall:user-joined", (m) => {
      if (m.userId === myUserId || !activeRef.current) return;
      setState(s => ({ ...s, members: m.members || [], peers: [...new Set([...s.peers, m.userId])] }));
      createPeer(m.userId, false); // they will send us an offer
    });

    // User left
    const offUserLeft = wsOn("vcall:user-left", (m) => {
      setState(s => ({ ...s, members: m.members || [], peers: s.peers.filter(id => id !== m.userId) }));
      cleanupPeer(m.userId);
    });

    // Received offer → answer
    const offOffer = wsOn("vcall:offer", async (m) => {
      if (!activeRef.current || !RTCSessionDescription) return;
      const peerId = m.fromId;
      let pc = pcsRef.current.get(peerId);
      if (!pc) {
        setState(s => ({ ...s, peers: [...new Set([...s.peers, peerId])] }));
        pc = createPeer(peerId, false);
      }
      if (!pc) return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(m.sdp));
        await flushIceQueue(peerId, pc); // ← flush queued ICE candidates
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        sendWs({ type: "vcall:answer", targetId: peerId, sdp: pc.localDescription });
      } catch (err) { console.warn("[vcall] offer handling error:", err); }
    });

    // Received answer → set remote description
    const offAnswer = wsOn("vcall:answer", async (m) => {
      if (!RTCSessionDescription) return;
      const pc = pcsRef.current.get(m.fromId);
      if (!pc || pc.signalingState === "stable") return;
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(m.sdp));
        await flushIceQueue(m.fromId, pc); // ← flush queued ICE candidates
      } catch (err) { console.warn("[vcall] answer handling error:", err); }
    });

    // ICE candidate — queue if remote description not yet set
    const offIce = wsOn("vcall:ice", async (m) => {
      if (!RTCIceCandidate || !m.candidate) return;
      const pc = pcsRef.current.get(m.fromId);

      if (!pc || !pc.remoteDescription) {
        // Queue: PC not created yet, OR remote description not set yet
        const queue = iceCacheRef.current.get(m.fromId) || [];
        queue.push(m.candidate);
        iceCacheRef.current.set(m.fromId, queue);
        return;
      }

      try { await pc.addIceCandidate(new RTCIceCandidate(m.candidate)); } catch {}
    });

    const offError = wsOn("vcall:error", (m) => {
      console.warn("[vcall] server error:", m?.code);
      if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
      activeRef.current = false;
      setState(s => ({ ...s, active: false }));
    });

    return () => {
      offCreated(); offJoined(); offUserJoined(); offUserLeft();
      offOffer(); offAnswer(); offIce(); offError();
    };
  }, [myUserId, createPeer, cleanupPeer, flushIceQueue]);

  // Cleanup on unmount
  useEffect(() => () => { if (activeRef.current) leaveCall(); }, [leaveCall]);

  return { ...state, startCall, joinCall, leaveCall, toggleMute };
}
