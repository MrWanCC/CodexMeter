# Quota Card Footer Design

## Goal

Make the quota card footer compact and semantically consistent with the remaining-quota donut.

## Approved Direction

Use the selected single-line scale layout:

- Left: `5H 剩余` or `7D 剩余`.
- Center: a thin progress track filled to the remaining percentage.
- Right: the exact remaining percentage, such as `74%`.
- The fill color continues to use the quota state color.

## Behavior

- Both the donut and footer represent remaining quota.
- The footer width binds to `remainingPercent(window)`, not `usedPercent(window)`.
- Missing quota data renders a zero-width fill and `--%` without changing layout.

## Visual Constraints

- Keep the footer on one line within the existing 720 x 490 window.
- Do not increase the quota card height.
- Keep the footer visually secondary to the donut and quota details.
- Preserve the existing card border and top divider.

## Verification

- Add a component-level regression assertion for the remaining-percentage binding and labels.
- Run the focused test suite and the production build.
