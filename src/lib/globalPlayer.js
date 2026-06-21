import { Audio } from "expo-av";
import { usePlayerStore } from "../store/player.js";
import { assetUrl } from "./api.js";
import { useAuthStore } from "../store/auth.js";

let _sound = null;

async function _initAudioMode() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    staysActiveInBackground: true,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: false,
    playThroughEarpieceAndroid: false,
  });
}

function _onStatus(status) {
  const store = usePlayerStore.getState();
  if (!status.isLoaded) return;
  store.setPosition(status.positionMillis / 1000);
  if (status.durationMillis) store.setDuration(status.durationMillis / 1000);
  store.setIsPlaying(status.isPlaying);
  if (status.didJustFinish) {
    store.setIsPlaying(false);
    store.setPosition(0);
  }
}

export const globalPlayer = {
  async play(track) {
    const store = usePlayerStore.getState();

    // Same track — toggle
    if (store.track?.id === track.id && _sound) {
      if (store.isPlaying) {
        await _sound.pauseAsync();
      } else {
        await _sound.playAsync();
      }
      return;
    }

    // Unload previous
    if (_sound) {
      try { await _sound.unloadAsync(); } catch {}
      _sound = null;
    }

    store.setTrack(track);
    store.setIsPlaying(false);
    store.setPosition(0);
    store.setDuration(track.duration || 0);

    try {
      await _initAudioMode();
      const token = useAuthStore.getState().token;
      const { sound } = await Audio.Sound.createAsync(
        { uri: assetUrl(track.src), headers: token ? { Authorization: `Bearer ${token}` } : undefined },
        { shouldPlay: true, progressUpdateIntervalMillis: 500 },
        _onStatus,
      );
      _sound = sound;
      store.setIsPlaying(true);
    } catch (e) {
      store.clear();
      throw e;
    }
  },

  async pause() {
    if (_sound) await _sound.pauseAsync().catch(() => {});
  },

  async resume() {
    if (_sound) await _sound.playAsync().catch(() => {});
  },

  async toggle() {
    const { isPlaying } = usePlayerStore.getState();
    if (isPlaying) await this.pause();
    else await this.resume();
  },

  async stop() {
    if (_sound) {
      try { await _sound.unloadAsync(); } catch {}
      _sound = null;
    }
    usePlayerStore.getState().clear();
  },

  async seekTo(seconds) {
    if (_sound) await _sound.setPositionAsync(seconds * 1000).catch(() => {});
  },
};
