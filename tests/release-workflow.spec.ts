import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('software release workflow', () => {
  const workflow = readFileSync(
    resolve(process.cwd(), '.github/workflows/release-software.yml'),
    'utf8',
  )

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
    const notes = readFileSync(
      resolve(process.cwd(), '.github/release-notes/software.md'),
      'utf8',
    )

    expect(workflow).toContain('.github/release-notes/software.md')
    expect(notes).toContain('推荐下载')
    expect(notes).toContain('__RELEASE_TAG__')
    expect(notes).not.toContain('鎺ㄨ崘')
  })
})
