## About Heidrun

<!-- identity:start -->
<!-- Generated from data/identity.json: pnpm docs:identity -->

Keep your agents working. Know which one needs you.

<!-- identity:end -->

To install Heidrun on a Mac with Apple silicon, run this command in a terminal. macOS opens Heidrun with no message.

```sh
curl -fsSL https://raw.githubusercontent.com/heidrun-org/heidrun/main/scripts/install.sh | sh
```

You can also download the disk image (`.dmg` file) below, open it, and drag Heidrun to your Applications folder.

## If macOS says that Heidrun is damaged

When you open Heidrun for the first time, macOS can show the message "“Heidrun” is damaged and can't be opened". Heidrun is not damaged. macOS shows this message because the disk image is not signed and not notarized by Apple, and because your web browser put a quarantine mark on the downloaded file. To open Heidrun:

1. Drag Heidrun to your Applications folder.
2. Run this command in a terminal. It removes the quarantine mark from Heidrun:
   ```bash
   xattr -dr com.apple.quarantine /Applications/Heidrun.app
   ```
3. Open Heidrun again.

