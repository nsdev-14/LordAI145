# LORD AI - Capacitor Android Conversion Guide

I have successfully converted your React web app (TanStack Start) into a Capacitor-powered Android application. Below are the details of the changes and the steps you need to follow to build your APK.

## Changes Made

1.  **Capacitor Integration**: Initialized Capacitor and added the Android platform.
2.  **SPA Mode Configuration**: Updated `vite.config.ts` to enable SPA mode. This is required because Android apps serve content from a local origin (e.g., `http://localhost`), which doesn't support the full SSR features of TanStack Start out-of-the-box.
3.  **API Connectivity**:
    - Created `src/lib/api-config.ts` to handle dynamic API base URLs.
    - Updated all AI-related routes (`chat.tsx`, `documents.tsx`, `research.tsx`, `study.tsx`, and `WakeWordProvider.tsx`) to use this configuration.
    - In a mobile context, the app will now attempt to reach your backend via a fully qualified URL instead of relative paths.
4.  **Build Scripts**: Added a `build:android` script to your `package.json` for one-command local builds.

## How to Build the APK

### 1. Set Your Backend URL

Before building, ensure your app knows where your deployed backend is. You can set this in your `.env` file:

```env
VITE_API_BASE_URL=https://your-deployed-app-url.com
```

Or update the fallback in `src/lib/api-config.ts`.

### 2. GitHub Actions Workflow (Action Required)

Due to security restrictions, I could not directly push the GitHub Actions workflow file to your repository. Please follow these steps to enable automatic APK builds:

1.  Go to your repository on GitHub.
2.  Create a new folder named `.github/workflows` if it doesn't exist.
3.  Create a file named `build-apk.yml` inside that folder.
4.  Paste the content of the attached `build-apk.yml.txt` into that file.
5.  Commit and push.

Every time you push to `main`, GitHub will now automatically build a debug APK and make it available in the "Actions" tab.

### 3. Local Build

If you have Android Studio installed locally, you can build the APK yourself:

```bash
npm install --legacy-peer-deps
npm run build:android
```

Then open the `android` folder in Android Studio to run it on an emulator or device.

## Important Notes

- **CORS**: Your deployed backend MUST allow requests from `capacitor://localhost` and `http://localhost`.
- **Permissions**: I have added basic internet permissions to the Android manifest. If you add features like camera or file uploads, you may need to update `AndroidManifest.xml`.
