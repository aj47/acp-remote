# Mobile App - Agent Guidelines

## Architecture Overview

The mobile app is a **thin client** that connects to the desktop app's remote server. It does NOT call LLM APIs directly.

**Request Flow:**
```
Mobile App → Cloudflare Tunnel → Desktop Remote Server → (ACP Agent OR LLM API)
```

## Connection Setup

### QR Code Deep Link Format
The desktop app displays a QR code for mobile connection. The QR encodes a deep link:
```
acpremote://config?baseUrl=<encoded-url>&apiKey=<key>
```

- **Scheme:** `acpremote://` (defined in `app.json`)
- **baseUrl:** URL-encoded path to desktop's `/v1` endpoint
- **apiKey:** Authentication token for the remote server

### Manual Configuration
Users can also manually enter credentials in Settings:
- **Base URL:** `https://<tunnel-url>/v1`
- **API Key:** From desktop terminal output

## Known Issues

### Push Notifications Disabled
Push notifications are completely stubbed out in `src/lib/pushNotifications.ts`.

**Reason:** The `expo-notifications` package pulls in `call-bind` which has a runtime compatibility issue with React Native's Hermes engine:
```
ERROR [TypeError: callBind is not a function (it is Object)]
```

**Current State:** All push notification functions return no-ops. To re-enable push notifications, this dependency conflict must be resolved first.

### App Name and URL Scheme
- **App Name:** "ACP Remote"
- **URL Scheme:** `acpremote://`

If a user has an older build with a different name/scheme, the QR code won't work. They need to rebuild the app.

## Common Mistakes

### ❌ "API key is required for openai" error
This error comes from the **desktop app**, not the mobile app.

**Cause:** Desktop's remote server is not checking for ACP mode.
**Fix:** See `apps/desktop/src/main/AGENTS.md`

### ❌ Assuming mobile app needs LLM API key
The mobile app never needs an LLM API key. It only needs:
1. Base URL to the desktop's remote server
2. API key for authenticating with the remote server

### ❌ QR code not working
Check that:
1. Mobile app is named "ACP Remote" (not an older build)
2. QR encodes `acpremote://` scheme, not raw URL
3. Desktop tunnel is active and URL is correct

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/openaiClient.ts` | HTTP client that connects to desktop server |
| `src/lib/pushNotifications.ts` | Stubbed push notification service |
| `src/store/config.ts` | Stores baseUrl and apiKey |
| `app.json` | App name and URL scheme configuration |

