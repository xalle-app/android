import * as FileSystem from "expo-file-system/legacy";
import { API_BASE } from "../config.js";
import { useAuthStore } from "../store/auth.js";

// FileSystemUploadType.MULTIPART = 1 (hardcoded for safety — enum may be undefined at runtime)
const MULTIPART = FileSystem?.FileSystemUploadType?.MULTIPART ?? 1;

// Upload images/videos via multipart form-data to POST /api/upload
// `assets` — array of { uri, type?, name? } (from expo-image-picker result.assets)
// Returns array of url strings from the server
export async function uploadAssets(assets = []) {
  const token = useAuthStore.getState().token;
  const urls = [];
  for (let i = 0; i < assets.length; i++) {
    const a = assets[i];
    const ext = a.uri.split(".").pop().toLowerCase() || "jpg";
    const isVideo = a.type === "video";
    const mimeType = isVideo ? `video/${ext}` : `image/${ext}`;
    const name = a.fileName || `media_${i}.${ext}`;
    const result = await FileSystem.uploadAsync(`${API_BASE}/api/upload`, a.uri, {
      fieldName: "images",
      httpMethod: "POST",
      uploadType: MULTIPART,
      headers: { Authorization: `Bearer ${token}` },
      mimeType,
      parameters: { name },
    });
    if (result.status < 200 || result.status >= 300) {
      let msg = `HTTP ${result.status}`;
      try { const j = JSON.parse(result.body); msg = j.error || msg; } catch {}
      throw new Error(msg);
    }
    const { urls: u } = JSON.parse(result.body);
    (u || []).forEach(x => urls.push(typeof x === "string" ? x : x.url));
  }
  return urls;
}

// Upload avatar image to POST /api/avatar
export async function uploadAvatar(asset) {
  const token = useAuthStore.getState().token;
  const ext = asset.uri.split(".").pop().toLowerCase() || "jpg";
  const result = await FileSystem.uploadAsync(`${API_BASE}/api/avatar`, asset.uri, {
    fieldName: "avatar",
    httpMethod: "POST",
    uploadType: MULTIPART,
    headers: { Authorization: `Bearer ${token}` },
    mimeType: `image/${ext}`,
    parameters: { name: `avatar.${ext}` },
  });
  if (result.status < 200 || result.status >= 300) {
    let msg = `HTTP ${result.status}`;
    try { const j = JSON.parse(result.body); msg = j.error || msg; } catch {}
    throw new Error(msg);
  }
  return JSON.parse(result.body);
}

// Upload a single audio file as a voice DM — returns the created message object
export async function uploadVoiceAsset(uri, convId) {
  const token = useAuthStore.getState().token;
  const ext = uri.split(".").pop().toLowerCase() || "m4a";
  const result = await FileSystem.uploadAsync(`${API_BASE}/api/messages/${convId}/voice`, uri, {
    fieldName: "audio",
    httpMethod: "POST",
    uploadType: MULTIPART,
    headers: { Authorization: `Bearer ${token}` },
    mimeType: `audio/${ext}`,
    parameters: { name: `voice_${Date.now()}.${ext}` },
  });
  if (result.status < 200 || result.status >= 300) throw new Error(`HTTP ${result.status}`);
  return JSON.parse(result.body);
}
