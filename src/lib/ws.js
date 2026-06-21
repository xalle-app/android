import { WS_BASE } from "../config.js";

// Simple typed event emitter
const _listeners = new Map();

export function wsOn(type, cb) {
  if (!_listeners.has(type)) _listeners.set(type, new Set());
  _listeners.get(type).add(cb);
  return () => _listeners.get(type)?.delete(cb);
}

function _emit(type, payload) {
  _listeners.get(type)?.forEach(cb => cb(payload));
}

// Singleton WS state
let _ws = null;
let _retryTimer = null;
let _alive = false;
let _token = null;
let _connected = false;
const _connListeners = new Set();

function _notifyConn(v) {
  _connected = v;
  _connListeners.forEach(cb => cb(v));
}

function _connect() {
  if (_ws && (_ws.readyState === 0 || _ws.readyState === 1)) return;
  const url = `${WS_BASE}/ws?token=${encodeURIComponent(_token)}`;
  _ws = new WebSocket(url);

  _ws.onopen = () => _notifyConn(true);

  _ws.onmessage = (e) => {
    try { const m = JSON.parse(e.data); _emit(m.type, m); } catch {}
  };

  _ws.onclose = () => {
    _notifyConn(false);
    if (_alive) _retryTimer = setTimeout(_connect, 2500);
  };

  _ws.onerror = () => _ws.close();
}

export const ws = {
  connect(token) {
    _token = token;
    _alive = true;
    _connect();
  },
  disconnect() {
    _alive = false;
    clearTimeout(_retryTimer);
    _ws?.close();
    _ws = null;
    _notifyConn(false);
  },
  send(data) {
    if (_ws?.readyState === 1) _ws.send(JSON.stringify(data));
  },
  isConnected: () => _connected,
  onConnChange: (cb) => {
    _connListeners.add(cb);
    return () => _connListeners.delete(cb);
  },
};
