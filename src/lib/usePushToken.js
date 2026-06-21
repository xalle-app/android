import { useEffect, useRef } from "react";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { api } from "./api.js";

const isExpoGo = Constants.appOwnership === "expo";

let _handlerSet = false;
async function ensureHandler() {
  if (_handlerSet) return;
  try {
    const N = await import("expo-notifications");
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    _handlerSet = true;
  } catch {}
}

export function usePushToken(authToken, navigationRef) {
  const registered = useRef(false);
  const subRef = useRef(null);

  useEffect(() => { ensureHandler(); }, []);

  useEffect(() => {
    if (!authToken || registered.current || isExpoGo) return;

    let cancelled = false;

    (async () => {
      try {
        const N = await import("expo-notifications");

        // Request permission
        const { status: existing } = await N.getPermissionsAsync();
        let finalStatus = existing;
        if (existing !== "granted") {
          const { status } = await N.requestPermissionsAsync();
          finalStatus = status;
        }
        if (finalStatus !== "granted" || cancelled) return;

        if (Platform.OS === "android") {
          await N.setNotificationChannelAsync("xalle_default", {
            name: "Xalle",
            importance: N.AndroidImportance.HIGH,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#c8745a",
            sound: "default",
          });
        }

        // Нативный FCM токен — работает с firebase-key.json на сервере напрямую
        try {
          const deviceToken = await N.getDevicePushTokenAsync();
          if (deviceToken?.data) {
            await api("/push/fcm-token", {
              method: "POST",
              body: { token: deviceToken.data, platform: Platform.OS },
            });
            registered.current = true;
          }
        } catch (e) {
          console.warn("[push] FCM token failed:", e?.message);
        }

        // Expo токен как запасной (работает если проект настроен на expo.dev)
        if (!registered.current) {
          try {
            const projectId = Constants.expoConfig?.extra?.eas?.projectId;
            if (projectId) {
              const tokenData = await N.getExpoPushTokenAsync({ projectId });
              if (tokenData?.data) {
                await api("/push/expo-token", { method: "POST", body: { token: tokenData.data } });
                registered.current = true;
              }
            }
          } catch {}
        }

        if (!registered.current || cancelled) return;

        // Храним подписку в ref чтобы cleanup мог её отменить
        subRef.current = N.addNotificationResponseReceivedListener((response) => {
          try {
            const data = response.notification?.request?.content?.data || {};
            if (data.type === "dm" || data.type === "group") {
              navigationRef?.current?.navigate?.("Main", { screen: "Messages" });
            } else {
              navigationRef?.current?.navigate?.(data.screen || "Notifications");
            }
          } catch {}
        });
      } catch {}
    })();

    return () => {
      cancelled = true;
      subRef.current?.remove();
      subRef.current = null;
    };
  }, [authToken]);
}
