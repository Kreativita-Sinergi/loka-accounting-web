# Loka Accounting — High-tech design

Figma: https://www.figma.com/design/mZdhKYAFgngzhMJCEojKKN

Team: Odhi Ahmad's Team. Created on 12 October 2026.

## Current state

- An editable desktop subscription dashboard draft was created in Figma, node `8:370`, using Inter and Simple Design System button/input instances, with local graphite/cyan color variables.
- The Figma Starter MCP call limit prevented creating the landing, mobile, login, and action-dialog frames and prevented inspecting screenshots of the dashboard. The Figma deliverable is incomplete and visually unverified.
- The local website implements the visual direction on the landing page, admin login, subscription dashboard, payment history, and subscription dialogs. Existing authentication and subscription API behavior is preserved.
- These website changes have not been deployed. The existing production admin URL is https://loka-accounting-admin.vercel.app.

## Review locally

Run `npm run dev -- --host 127.0.0.1 --port 5190`.

- Landing: http://127.0.0.1:5190/
- Admin: http://127.0.0.1:5190/admin

The authenticated admin requires the existing backend and valid admin credentials. No demonstration credential or authentication bypass was added.

## Visual direction

Graphite background `#080c12`, panels `#101721`, secondary panels `#141f2b`, borders `#263445`, primary text `#eef5fc`, secondary text `#9aaec3`, cyan accent `#69e7eb`. Inter is the product typeface; JetBrains Mono is used sparingly for labels. Statuses use green, cyan, amber, and muted neutral colors alongside text.

The landing has an orbital ledger scene, a dashboard preview explicitly labeled as example data, feature modules, workflow, optional POS integration, security controls, pricing, FAQ, and registration/login actions. The admin has a split login composition, navigation, four subscription statistics, search/filter, table actions, pagination, and themed dialogs.

## Motion and rendering

Motion for React provides viewport reveals and admin entry transitions. `MotionConfig reducedMotion="user"` respects reduced-motion preferences. The Three.js scene imports only near the viewport, caps pixel density at 1.6, pauses offscreen or in a background tab, disposes resources on unmount, and shows a vector fallback when WebGL or its optional module fails. Reduced motion uses a static 3D render.

Implementation references: https://motion.dev/docs/react-motion-config and https://threejs.org/manual/pages/cleanup.html.

## Validation

`npm run build`, `npm run lint`, and `npm test` passed (21 tests). The production build emits the expected size warning for the separate Three.js chunk (approximately 537 kB before gzip).

Visual browser verification remains pending. Native Firefox automation navigated to the preview URL, but screenshot responses repeatedly showed a stale unrelated tab; no screenshot sign-off is claimed. Check desktop and mobile layout, the orbital scene/fallback, login error, search/status/pagination, payment history, and subscription action dialogs with a local test backend before deployment.

## Remaining Figma work

When MCP capacity is available, inspect and repair the dashboard's computed layout first; its creation response returned pre-layout frame dimensions. Then create editable landing desktop/mobile, admin login, and action-dialog frames, add motion specifications, and visually inspect each final composition. Keep the website and Figma status separate until these steps pass.
