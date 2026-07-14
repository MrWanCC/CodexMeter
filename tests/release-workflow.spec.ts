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
    expect(workflow).toContain('workflow_call:')
    expect(workflow).toContain('refs/tags/${{ steps.release.outputs.tag }}')
    expect(workflow).toContain('commit: ${{ steps.source.outputs.commit }}')
    expect(workflow).toContain('ref: ${{ needs.validate-source.outputs.commit }}')
  })

  it('handles release inputs safely with least-privilege permissions', () => {
    expect(workflow).toContain('REQUESTED_TAG: ${{ inputs.tag }}')
    expect(workflow).toContain('REF_NAME: ${{ github.ref_name }}')
    expect(workflow).toContain('permissions:\n  contents: read')
    expect(workflow).toContain('permissions:\n      contents: write')
    expect(workflow).toContain('persist-credentials: false')
    expect(workflow).toContain('Verify release tag is unchanged')
    expect(workflow).toContain('actual_commit')
    expect(workflow).toContain('EXPECTED_COMMIT')
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

  it('provides a default-branch dispatcher for manual releases', () => {
    const dispatcher = readFileSync(
      resolve(process.cwd(), '.github/workflows/dispatch-software-release.yml'),
      'utf8',
    )

    expect(dispatcher).toContain('workflow_dispatch:')
    expect(dispatcher).toContain(
      'MrWanCC/CodexMeter/.github/workflows/release-software.yml@0760e80440315df4c657a31d2d82d5995f9cb317',
    )
    expect(dispatcher).toContain('tag: ${{ inputs.tag }}')
    expect(dispatcher).not.toContain('secrets: inherit')
  })
})
