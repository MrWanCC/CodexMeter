# Software Release Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make software releases reproducible from `software-edition`, with validated tags, UTF-8 release notes, and consistently named Windows and macOS assets.

**Architecture:** A source-level Vitest regression test validates the workflow contract. The release workflow adds a prerequisite validation job, all platform builds depend on it, and the publish job renders a checked-in UTF-8 Markdown template before updating the GitHub Release.

**Tech Stack:** GitHub Actions, electron-builder, Bash, PowerShell, Vitest.

## Global Constraints

- Stable software tags use `vX.Y.Z` and must point to a commit contained in `software-edition`.
- Hardware tags and workflows remain unchanged.
- Manual runs use an existing software tag and never create or move tags.
- Release assets keep the exact names documented in the design.
- `v0.1.2` is not created by this plan.

---

### Task 1: Lock the release contract with a regression test

**Files:**
- Create: `tests/release-workflow.spec.ts`
- Inspect: `.github/workflows/release-software.yml`
- Inspect: `.github/release-notes/software.md`

**Interfaces:**
- Consumes: release workflow YAML and release-note template as UTF-8 text.
- Produces: a regression test that fails until branch validation, artifact naming, and readable Chinese notes exist.

- [ ] **Step 1: Write the failing test**

```ts
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('software release workflow', () => {
  const workflow = readFileSync(resolve(process.cwd(), '.github/workflows/release-software.yml'), 'utf8')

  it('publishes only tags contained in software-edition', () => {
    expect(workflow).toContain('Validate software release source')
    expect(workflow).toContain('origin/software-edition')
    expect(workflow).toContain('git merge-base --is-ancestor')
    expect(workflow).toContain('needs: validate-source')
  })

  it('uses consistent release asset names', () => {
    expect(workflow).toContain('CodexMeter-$env:RELEASE_TAG-win-x64-portable.exe')
    expect(workflow).toContain('CodexMeter-${RELEASE_TAG}-software-mac-${{ matrix.arch }}.dmg')
  })

  it('renders readable UTF-8 release notes from a checked-in template', () => {
    const notes = readFileSync(resolve(process.cwd(), '.github/release-notes/software.md'), 'utf8')
    expect(workflow).toContain('.github/release-notes/software.md')
    expect(notes).toContain('推荐下载')
    expect(notes).toContain('__RELEASE_TAG__')
    expect(notes).not.toContain('鎺ㄨ崘')
  })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `npm test -- --run tests/release-workflow.spec.ts`

Expected: FAIL because `.github/release-notes/software.md` and source validation are missing.

- [ ] **Step 3: Commit the failing regression test**

```powershell
git add tests/release-workflow.spec.ts
git commit -m "test: define software release workflow contract"
```

### Task 2: Validate tags and publish UTF-8 release assets

**Files:**
- Create: `.github/release-notes/software.md`
- Modify: `.github/workflows/release-software.yml`
- Test: `tests/release-workflow.spec.ts`

**Interfaces:**
- Consumes: an existing `vX.Y.Z` tag and `origin/software-edition`.
- Produces: three GitHub Release assets and readable release notes for the validated tag.

- [ ] **Step 1: Add the UTF-8 release-note template**

```markdown
## 推荐下载

### Windows 用户

下载 `CodexMeter-__RELEASE_TAG__-win-x64-portable.exe`，双击即可运行，无需安装。

### macOS 用户

- Apple 芯片：`CodexMeter-__RELEASE_TAG__-software-mac-arm64.dmg`
- Intel 芯片：`CodexMeter-__RELEASE_TAG__-software-mac-x64.dmg`

### 不要下载这些

`Source code (zip)` 和 `Source code (tar.gz)` 是源码包，不是普通用户运行的软件。

## 本版说明

- 本地运行，只读取授权后的额度数据。
- Windows 版支持跟随系统代理完成 OAuth 和额度请求。
```

- [ ] **Step 2: Add a validation job before platform builds**

The job checks out the selected existing tag with full history, validates `^v[0-9]+\.[0-9]+\.[0-9]+$`, fetches `software-edition`, and runs:

```bash
git merge-base --is-ancestor "$(git rev-parse HEAD)" origin/software-edition
```

All build and publish jobs declare `needs: validate-source`; publish additionally needs both platform build jobs.

- [ ] **Step 3: Replace inline garbled notes with template rendering**

```bash
sed "s/__RELEASE_TAG__/${RELEASE_TAG}/g" .github/release-notes/software.md > release-notes.md
```

The publish job checks out the validated tag before rendering the template.

- [ ] **Step 4: Run focused and full verification**

Run: `npm test -- --run tests/release-workflow.spec.ts`

Expected: 3 tests pass.

Run: `npm test`

Expected: all test files pass with zero failures.

- [ ] **Step 5: Review workflow diff and commit**

```powershell
git diff --check
git diff -- .github/workflows/release-software.yml .github/release-notes/software.md tests/release-workflow.spec.ts
git add .github/workflows/release-software.yml .github/release-notes/software.md
git commit -m "ci: harden software release publishing"
```

- [ ] **Step 6: Push without creating a release tag**

```powershell
git push origin software-edition
```

Expected: workflow and tests are available on `software-edition`; no `v0.1.2` Release exists yet.
