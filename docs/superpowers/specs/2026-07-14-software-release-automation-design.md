# Software Release Automation Design

## Goal

Publish software-edition releases reproducibly from the `software-edition` branch while keeping hardware releases independent.

## Release source

- Stable software tags use `vX.Y.Z` and must point to a commit contained in `software-edition`.
- Hardware tags and workflows remain unchanged.
- `v0.1.2` will only be created after the Windows proxy-login fix is confirmed on the affected computer.

## Build outputs

Each software release runs the full test suite, then builds these assets:

- `CodexMeter-vX.Y.Z-win-x64-portable.exe`
- `CodexMeter-vX.Y.Z-software-mac-arm64.dmg`
- `CodexMeter-vX.Y.Z-software-mac-x64.dmg`

The publish job downloads all three artifacts and creates or updates the matching GitHub Release.

## Safety checks

- Reject tags that are not contained in `origin/software-edition`.
- Do not publish if any test or platform build fails.
- Keep attachment labels equal to their filenames.
- Use a checked-in UTF-8 release-note template to prevent shell encoding corruption.
- Manual runs must use an existing software tag; they do not create or move tags.

## Verification

- Validate workflow YAML structure and required steps with automated source tests.
- Run the existing application test suite.
- Confirm filenames and release-note text from the workflow source.
- Create the next release tag only after external login verification succeeds.
