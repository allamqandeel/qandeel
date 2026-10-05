/**
 * A3-02 — the production `PushPlatformPort`, over Expo's first-party `expo-notifications` (record §5: the smallest
 * production-safe path; it registers with APNs / FCM natively and returns the RAW platform device token — Expo's own push
 * relay, `getExpoPushTokenAsync`, is never used, so no third-party gateway exists in this path).
 *
 * Nothing here decides Product meaning: it reads and requests the OS permission, reads the token, registers the Android
 * channels it is given, keeps a notification from being presented while the app is in front, and reports taps. A tap is
 * read strictly (`tapFromPayload`) and carries an opaque item id only.
 */
import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

import { tapFromPayload, type ChannelSpec, type NotificationTap, type OsPermissionState, type PushPlatformPort } from './platform-port';

function permissionOf(answer: Notifications.NotificationPermissionsStatus): OsPermissionState {
  // Apple provisional authorization is not adopted (P3 §11): it is never requested, and is not read as a grant.
  const provisional = Platform.OS === 'ios' && answer.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  const permission = answer.status === 'granted' && !provisional ? 'GRANTED' : answer.status === 'denied' ? 'DENIED' : 'NOT_REQUESTED';
  return { permission, canAskAgain: answer.canAskAgain };
}

/** The tap payload: `content.data` for every notification expo-notifications presents or receives from FCM / APNs. */
function tapOf(response: Notifications.NotificationResponse | null): NotificationTap | null {
  if (response === null || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return null;
  return tapFromPayload(response.notification.request.content.data);
}

const ANDROID_PACKAGE = 'com.qandeel.mobile';

export function createExpoPushPlatformPort(): PushPlatformPort {
  const platform = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
  return {
    platform,
    // The build's `aps-environment` entitlement: Release builds are signed for production (app.json plugin `mode`).
    apnsEnvironment: platform === 'IOS' ? (__DEV__ ? 'SANDBOX' : 'PRODUCTION') : null,
    readPermission: async () => permissionOf(await Notifications.getPermissionsAsync()),
    requestPermission: async () => permissionOf(await Notifications.requestPermissionsAsync({
      // No badge (P3 §6, D48), no provisional, no critical alert (P3-A platform gate: never assumed, never authorized).
      ios: { allowAlert: true, allowSound: true, allowBadge: false },
    })),
    async deviceToken() {
      try {
        const token = await Notifications.getDevicePushTokenAsync();
        return typeof token.data === 'string' && token.data.length > 0 ? token.data : null;
      } catch {
        // No push service is configured for this build (e.g. no Firebase project), or the platform refused: no token.
        return null;
      }
    },
    onTokenChange(listener) {
      const subscription = Notifications.addPushTokenListener((token) => {
        if (typeof token.data === 'string' && token.data.length > 0) listener(token.data);
      });
      return () => subscription?.remove?.();
    },
    async ensureChannels(channels: readonly ChannelSpec[]) {
      if (platform !== 'ANDROID') return;
      for (const channel of channels) {
        // DEFAULT importance for every channel: the Product class is not an OS level (P3 §9). No badge dot: the
        // platform badge is not used (record §9). Lock Screen visibility stays the device's own (the words are already
        // bounded to the reader's ceiling, so the OS can only show less).
        await Notifications.setNotificationChannelAsync(channel.id, {
          name: channel.name, importance: Notifications.AndroidImportance.DEFAULT, showBadge: false,
        });
      }
    },
    installForegroundPolicy(onForegroundArrival) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({ shouldShowBanner: false, shouldShowList: false, shouldPlaySound: false, shouldSetBadge: false }),
      });
      const subscription = Notifications.addNotificationReceivedListener((notification) => {
        if (tapFromPayload(notification.request.content.data) !== null) onForegroundArrival();
      });
      return () => {
        subscription.remove();
        Notifications.setNotificationHandler(null);
      };
    },
    onTap(listener) {
      const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
        const tap = tapOf(response);
        if (tap !== null) {
          Notifications.clearLastNotificationResponse();
          listener(tap);
        }
      });
      return () => subscription?.remove?.();
    },
    async takeLaunchTap() {
      const tap = tapOf(Notifications.getLastNotificationResponse());
      if (tap !== null) Notifications.clearLastNotificationResponse();
      return tap;
    },
    async openNotificationSettings() {
      if (platform === 'ANDROID') {
        try {
          await Linking.sendIntent('android.settings.APP_NOTIFICATION_SETTINGS', [
            { key: 'android.provider.extra.APP_PACKAGE', value: Constants.expoConfig?.android?.package ?? ANDROID_PACKAGE },
          ]);
          return;
        } catch {
          // An OEM without the notification-settings screen: the app's own settings page is the hand-off.
        }
      }
      await Linking.openSettings();
    },
  };
}
