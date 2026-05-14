# Mobile build artifacts

Place the production Android APK here as `concorde-workly.apk` after each EAS build.

The file is served by `DownloadController.cs` at:
- `GET /api/download/android` → downloads the APK
- `GET /api/download/android/info` → metadata (size, publishedAt)

## Build & publish (manual)

```bash
cd abrpoint.mobile
eas build --platform android --profile production
# Download the resulting .apk from the EAS dashboard, then:
cp ~/Downloads/build-xxx.apk ABRPOINT.Server/wwwroot/downloads/concorde-workly.apk
```

In Docker production, mount this directory as a volume so it survives container rebuilds.
