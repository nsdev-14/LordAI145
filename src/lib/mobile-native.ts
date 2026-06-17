import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Device } from "@capacitor/device";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { Keyboard } from "@capacitor/keyboard";
import { LocalNotifications } from "@capacitor/local-notifications";
import { Network } from "@capacitor/network";
import { Share } from "@capacitor/share";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";

export const isNativeMobile = () => Capacitor.isNativePlatform();

export async function initializeMobileRuntime() {
  if (!isNativeMobile()) return;
  await Promise.allSettled([
    StatusBar.setStyle({ style: Style.Dark }),
    StatusBar.setBackgroundColor({ color: "#0a0e1a" }),
    StatusBar.setOverlaysWebView({ overlay: true }),
    Keyboard.setAccessoryBarVisible({ isVisible: false }),
    SplashScreen.hide(),
  ]);
}

export const mobileDevice = {
  info: () => Device.getInfo(),
  id: () => Device.getId(),
  battery: () => Device.getBatteryInfo(),
};

export const mobileCamera = {
  takePhoto: () =>
    Camera.getPhoto({
      quality: 82,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Camera,
      saveToGallery: false,
    }),
  pickImage: () =>
    Camera.getPhoto({
      quality: 82,
      allowEditing: false,
      resultType: CameraResultType.Uri,
      source: CameraSource.Photos,
    }),
};

export const mobileFiles = {
  writeText: (path: string, data: string) =>
    Filesystem.writeFile({ path, data, directory: Directory.Documents, encoding: Encoding.UTF8 }),
  readText: (path: string) =>
    Filesystem.readFile({ path, directory: Directory.Documents, encoding: Encoding.UTF8 }),
  listDocuments: (path = "") => Filesystem.readdir({ path, directory: Directory.Documents }),
};

export const mobileNotifications = {
  requestPermissions: () => LocalNotifications.requestPermissions(),
  scheduleReminder: async (title: string, body: string, at: Date) => {
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display !== "granted") return { scheduled: false };
    await LocalNotifications.schedule({
      notifications: [{ id: Date.now() % 2147483647, title, body, schedule: { at } }],
    });
    return { scheduled: true };
  },
};

export const mobileHaptics = {
  light: () => isNativeMobile() && Haptics.impact({ style: ImpactStyle.Light }).catch(() => undefined),
  success: () =>
    isNativeMobile() && Haptics.notification({ type: NotificationType.Success }).catch(() => undefined),
  error: () =>
    isNativeMobile() && Haptics.notification({ type: NotificationType.Error }).catch(() => undefined),
};

export const mobileNetwork = {
  status: () => Network.getStatus(),
  listen: (callback: Parameters<typeof Network.addListener>[1]) =>
    Network.addListener("networkStatusChange", callback),
};

export const mobileShare = {
  shareText: (title: string, text: string, url?: string) => Share.share({ title, text, url }),
};

export const mobileApp = {
  getState: () => App.getState(),
  getInfo: () => App.getInfo(),
};