# Release Checklist

Release is blocked until every item below has an owner, review date, and evidence.

- Run `npm ci`, `npm run test:syntax`, `npm test`, and `npm audit --omit=dev` on the release commit.
- Build the hook DLL from source and verify its pinned SHA-256 checksum.
- Sign the hook DLL and every distributed EXE with the approved Authenticode certificate.
- Run `npm run verify:release`; unsigned or invalid artifacts must fail the release.
- Confirm the package contains the pinned Whisper model and only `assets/dll/wexin_hook.dll`.
- Confirm CSV and HTML export controls and writers are absent.
- Obtain legal approval for DLL injection, process-memory access, chat decryption, and local chat processing.
- Review the privacy notice, per-submission Codex consent, retention, deletion, and diagnostic-log handling.
- Record the supported WeChat versions and complete a clean-machine smoke test before publishing.
