import { Capacitor } from "@capacitor/core";

export const getApiBaseUrl = () => {
  if (Capacitor.isNativePlatform()) {
    // Use the environment variable if provided, otherwise fallback to a relative path
    // which works if the app is served from the same domain.
    return import.meta.env.VITE_API_BASE_URL || "";
  }
  return "";
};
