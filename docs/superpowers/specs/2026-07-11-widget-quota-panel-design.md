# Floating Widget Quota Panel Design

## Goal

Make the expanded floating widget complete at a glance without turning it into a miniature dashboard.

## Approved Direction

Replace the current flat four-row list with two quota blocks and one compact metadata footer.

## Window Geometry

- Expanded BrowserWindow: 390 x 176 px.
- Visible orb remains 72 x 72 px.
- Expanded panel width: 282 px.
- Expansion remains anchored to the same bottom-right point and grows left and upward.
- The collapsed 104 x 104 px window and its click behavior do not change.

## Information Architecture

### Five-hour quota block

- Label: `5小时额度`.
- Remaining percentage aligned right.
- Status badge beside the percentage: `充足`, `注意`, `紧张`, `严重`, `已耗尽`, or `无数据`.
- A thin progress bar directly below the label row.
- Reset copy below the bar, such as `2分钟后重置`.
- When remaining quota is below 20 percent, use orange for the bar, percentage, and status badge.

### Seven-day quota block

- Label: `7天额度`.
- Remaining percentage and status badge aligned right.
- A violet progress bar below the label row.
- Reset copy below the bar, showing a readable date and time such as `07-18 08:30 重置`.

### Metadata footer

- Left: `重置卡 2张` or `重置卡 0张`.
- Right: refresh recency, such as `刚刚刷新` or `3分钟前刷新`.
- Keep this row visually secondary.

## Removed Content

- Remove the standalone `额度不足` row because its state and reset countdown belong inside the five-hour quota block.
- Do not show a 5H/7D segmented control; both quotas are always visible.
- Do not add navigation, settings, or extra actions to this panel.

## Data and States

- Use only the existing real quota snapshot and reset-card data.
- Missing quota data keeps the block in place and renders `--%`, `无数据`, a zero-width muted bar, and `暂无重置时间`.
- Invalid reset timestamps render `暂无重置时间` without hiding the block.
- Refresh recency derives from `snapshot.refreshedAt`.

## Accessibility

- Primary text and percentages must remain readable on the dark panel.
- Status is expressed with text as well as color.
- Progress bars expose meaningful labels and values.
- Warning orange is not used as the only signal for low quota.

## Verification

- Add component regression assertions for both quota blocks, both reset labels, both progress values, metadata footer, and removal of the standalone warning row.
- Verify normal, low-quota, and missing-data states.
- Run the full Vitest suite and production build.
- Restart Electron, capture the expanded widget at 390 x 176 px, and verify that no label, badge, progress bar, or footer is clipped.
