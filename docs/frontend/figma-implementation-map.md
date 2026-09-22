# Figma implementation map

Source: `ScrapTrace-UI` (file key `Y24Ih9PYuXpiJWRjYS05AJ`), page "Page 1", 16 top-level frames. Inspected through the Figma MCP server on 2026-09-20.

Every frame has an implemented screen, built as UI over fictional sample data taken from the design. Workflows that need services or storage (saving records, approving intake, audit decisions, publishing, label commits, clearing local data) are **not** implemented. Their controls are visible and keyboard-operable and report that the action arrives in a later milestone.

## Access notes

- All 16 frames were listed. 15 were inspected as rendered screenshots. The design-system frame was also read as generated design context (exact colours, sizes, radii, status mappings).
- **`collector-home-arabic` (3:1391) could not be screenshotted**: the Figma MCP call limit for the Starter plan was reached. It is implemented through the same collector home rendered in Arabic (RTL) and is **not visually compared** against its own frame. Re-inspect it when the limit resets.
- The file defines **no Figma variables** (`get_variable_defs` returned `{}`), so tokens were read from the design-system frame's swatches and component values.
- Several sidebar and bottom-navigation icons render as placeholder ellipses or squares in the frames (an export artefact). They are replaced with `lucide-react` icons.
- The mobile frames include an iOS status bar and device bezel. These are presentation chrome and are not implemented.
- Frame photographs (workbench evidence photo, circuit-board image) were not downloaded. The design-context tool was rate limited, and the images depict real-world scenes that must come from the evidence service. Neutral placeholders are used.

## 1. Frame inventory

Roles are contract identifiers from `packages/contracts`. Every route is under `/[locale]`.

| Figma frame | Node | Route | Role | Target | Shell | Implementation |
| --- | --- | --- | --- | --- | --- | --- |
| scrap-trace-design-system | 3:8 | `/dev/components` (dev only, 404 in production) | none | reference | none | Tokens in `globals.css`; every component and state shown in the showcase |
| welcome-language | 3:1022 | `/onboarding` | public | mobile 390 | Authentication | `LanguageChoice`: choose a language, confirm, continue to the privacy step in that language |
| role-sign-in | 3:1061 | `/sign-in` | public (development preview) | mobile 390 | Authentication | `RolePreview`: select a role, enter its workspace. No authentication |
| privacy-consent | 3:1109 | `/onboarding/privacy` | public | mobile 390 | Authentication | `PrivacyConsent`: optional choice is local UI state, not persisted |
| collector-home | 3:1143 | `/collector` | collector | mobile 390 | Collector | `CollectorHome` over sample records |
| mobile-collector-en | 3:176 | `/collector/records` | collector | mobile 402 | Collector | `RecordsScreen` over sample records |
| mobile-collector-ar | 3:325 | `/ar/collector/capture` | collector | mobile 402, RTL | Collector | `CaptureForm`: real required-field validation; saving is deferred |
| collector-home-arabic | 3:1391 | `/ar/collector` | collector | mobile 390, RTL | Collector | Same `CollectorHome` in Arabic. Frame not inspected |
| account-privacy | 3:1282 | `/collector/profile` | collector | mobile 390 | Collector | `AccountScreen`; training switch is local UI only |
| clear-local-data | 3:1339 | `/collector/profile/clear-cache` | collector | mobile 390 | Collector | `ClearCacheScreen`; confirming reports that nothing was deleted, because no local storage exists yet |
| mobile-recycler-en | 3:266 | `/recycler/intake` | recycler | mobile 402 | Operational | `IntakeScreen`; QR graphic and evidence photo are placeholders |
| recycler-home | 3:1222 | `/recycler` | recycler | mobile 390 | Operational | `RecyclerHome` |
| ProgrammeReviewerShell | 3:534 | `/review`, `/review/queue` | programme_reviewer | desktop 1440 | Operational | `ReviewQueue`: metrics, working filters and search, responsive table over sample rows |
| ProgrammeManagerShell | 3:637 | `/management` | programme_manager | desktop 1440 | Operational | `ManagementOverview`: estimates and verified outcomes in separate panels |
| SafetyContentAdminShell | 3:722 | `/administration/safety` | safety_content_administrator | desktop 1440 | Administration | `SafetyCards`: cards and creation form; publishing deferred |
| DataMlReviewerShell | 3:796 | `/administration/ml` | data_ml_reviewer | desktop 1440 | Administration | `ModelReview`: metrics, image frame, correction form; commit deferred |
| ArabicProgrammeManagerShell | 3:869 | `/ar/management` | programme_manager | desktop 1440, RTL | Operational | Same `ManagementOverview` in Arabic RTL with Arabic-Indic digits |
| SharedSecurityStatesShell | 3:968 | `/access-denied`, `/session-expired` | public / any | desktop 1440 | Public | `SecurityStateCard`, one card per route (see deviations) |

## 2. Components and interactive elements per frame

| Figma frame | Main reusable components | Interactive elements | Related dialog, drawer or sheet |
| --- | --- | --- | --- |
| scrap-trace-design-system | StatusBadge (17 states), InfoPanel (danger, warning, success), Alert, Input, Select, Checkbox, RadioGroup, Field | inputs, select, checkbox, radio | none |
| welcome-language | Language option cards (radio group), Button, note | four language options, Confirm | none |
| role-sign-in | Role option cards (radio group), Alert, Button | six role options, Enter | none |
| privacy-consent | Card, Checkbox, status chip, note, Button, link button | optional-training checkbox, Accept, Decline | none |
| collector-home | InfoPanel-style card, ListItem, StatusBadge, link button | Capture, resume draft, Nearby link | Menu drawer (mobile header) |
| mobile-collector-en | Sync summary card, ListItem, StatusBadge, InfoPanel, link button | View Map, Capture | Menu drawer |
| mobile-collector-ar | Field, Input, Select, InfoPanel, Button | serial input, category select, Register | Menu drawer |
| collector-home-arabic | as collector-home | as collector-home | Menu drawer |
| account-privacy | DefinitionList, Switch, destructive outline link button | training switch, Clear cache, Sign out | none |
| clear-local-data | InfoPanel, status rows, destructive Button, link button | Confirm clear, Cancel | none (a page, not a dialog, in the frame) |
| mobile-recycler-en | Card, QR graphic, EvidencePlaceholder, DefinitionList, StatusBadge, Button | Approve Intake Receipt | Menu drawer |
| recycler-home | Card, Input, Button, ListItem, StatusBadge, InfoPanel, DefinitionList | code input, Apply | Menu drawer |
| ProgrammeReviewerShell | MetricCard, FilterControl, SearchInput, DataTable, StatusBadge, Button | two filters, search, Audit per row | Menu drawer (below 1024px) |
| ProgrammeManagerShell | MetricCard, Card, DefinitionList | none beyond shell | Menu drawer (below 1024px) |
| SafetyContentAdminShell | Card, Badge, StatusBadge, Field, Input, Button | two inputs, Publish | Menu drawer (below 1024px) |
| DataMlReviewerShell | MetricCard, Card, EvidencePlaceholder, DefinitionList, Field, Select, Checkbox, Button | select, checkbox, Commit | Menu drawer (below 1024px) |
| ArabicProgrammeManagerShell | as ProgrammeManagerShell | as ProgrammeManagerShell | Menu drawer (below 1024px) |
| SharedSecurityStatesShell | SecurityStateCard, Button | Return / Sign in again | none |

All shells also provide: skip link, language menu, user menu (desktop), sidebar or bottom navigation, breadcrumb (desktop), and offline banner. The showcase also demonstrates Dialog, ConfirmDialog, BottomSheet, Drawer, DropdownMenu, Tooltip and Toast, which the frames imply but do not show.

## 3. States per frame

"Not designed" means the frame shows no such state and the implementation uses the shared component only where the screen can actually reach the state.

| Figma frame | Loading | Empty | Error | Offline |
| --- | --- | --- | --- | --- |
| Authentication frames (3) | Route-level skeleton (`loading.tsx`) | not designed | not designed; route error boundary | Offline banner (real `navigator.onLine`) |
| collector-home, mobile-collector-en, collector-home-arabic | route skeleton | not designed (sample data always present) | not designed; route error boundary | Offline banner; the frames show it permanently |
| mobile-collector-ar | route skeleton; Button `loading` available | not designed | Field validation error announced with `role="alert"` | Offline banner |
| account-privacy, clear-local-data | route skeleton | not designed | frame's "Mock Failure" row is shown as a static preview | Offline banner |
| mobile-recycler-en, recycler-home | route skeleton | not designed | not designed | Offline banner; the frames show it permanently |
| ProgrammeReviewerShell | route skeleton | `EmptyState` when filters match nothing (not in the frame) | route error boundary | Offline banner |
| ProgrammeManagerShell, ArabicProgrammeManagerShell | route skeleton | not designed | route error boundary | Offline banner |
| SafetyContentAdminShell, DataMlReviewerShell | route skeleton | not designed | route error boundary | Offline banner |
| SharedSecurityStatesShell | not designed | not designed | this frame is the 403 and session-expired error state | Offline banner replaces the frame's static "3 days unsynchronized" alert |

## 4. Missing or unclear design information, per frame

| Figma frame | Gap |
| --- | --- |
| scrap-trace-design-system | No hover, pressed, focus or disabled states drawn; fallbacks used. No dark theme |
| welcome-language | No error state for a failed language save; brand header of the shell is not in the frame |
| role-sign-in | Frame names roles differently ("Collector Node", "Recycler Intake"); the contract role labels are used |
| privacy-consent | Persistence and withdrawal of consent not designed |
| collector-home | Behaviour of "Resume" and "Nearby Location Info" not specified; both link to capture and locations |
| mobile-collector-en | "View Map" destination not designed; links to the Nearby placeholder |
| mobile-collector-ar | Frame has no page heading and no photo capture UI; heading is visually hidden on mobile |
| collector-home-arabic | Frame not inspected |
| account-privacy | Sign-out behaviour not designed; links to the sign-in preview |
| clear-local-data | Result states appear only as "demo previews"; real success and failure UI not designed |
| mobile-recycler-en | QR rendering and the evidence photo are images; no scan camera UI designed |
| recycler-home | "Apply" outcome not designed |
| ProgrammeReviewerShell | "Audit" destination not designed; no pagination shown though the component exists |
| ProgrammeManagerShell | No chart or export designed; only the figures shown |
| SafetyContentAdminShell | Publish outcome, approval workflow and validation states not designed |
| DataMlReviewerShell | Image size and zoom behaviour not designed |
| ArabicProgrammeManagerShell | Same as the English frame |
| SharedSecurityStatesShell | Both states share one frame; header badge "System Security View" not tied to a route |

## 5. Design tokens

Values come from the design-system frame. Fallbacks (marked) are values Figma does not specify.

| Semantic token | Value | Figma source |
| --- | --- | --- |
| `--primary` | `#176B52` | Teal (Primary Government) |
| `--primary-dark` | `#0F4C3A` | Dark Forest (Brand Dark); headings |
| `--accent` | `#237A57` | Mid-Teal (Active Accent) |
| `--secondary` | `#C78A12` | Amber (Safety Alert); offline banner |
| `--warning` | `#A15C00` | Dark Amber (Muted Alert) |
| `--danger` | `#B42318` | Red (Warning / Error) |
| `--info` | `#2563EB` | Blue (Info / GPS) |
| `--background` | `#F7F9F8` | Light Sage (Base BG) |
| `--surface` | `#FFFFFF` | White (Card Surface) |
| `--foreground` | `#18211E` | Charcoal (Core Text) |
| `--muted-foreground` | `#5E6B66` | Muted Sage (Secondary) |
| `--border` | `#DCE5E1` | Border Grey (Dividers) |
| status tints | `#EBF1EE`, `#ECFDF5`, `#EFF6FF`, `#FEF3C7`, `#FFF4E5`, `#FEF2F2`, `#F3F4F6`, `#FFFBEB`, `#FFF9E6` | badges, panels |
| Radii | 4px badges, 6px controls, 8px cards | design-system frame |
| Touch target | 44px | "Min 44px targets" |
| Type | Noto Sans, Noto Sans Arabic for Arabic; 32/20/18/14/12/11px | design-system frame |

Fallbacks (not in Figma): `--focus` `#2563EB` at 3px, `--primary-hover` `#0F5B45`, disabled opacity 0.5, `--shadow-raised`, container width `72rem`, sidebar width `15rem`, header height `4.75rem`, breakpoints (Tailwind defaults plus `xs` 30rem). Layout switches between mobile and desktop at 1024px.

## 6. Design gaps and decisions

1. Sidebar and bottom-navigation icons are placeholder shapes in Figma. Decision: outlined `lucide-react` icons. Confirm with design.
2. Frames show a single language toggle for one other language. ScrapTrace supports four, so the control is a menu of all four. Confirm with design.
3. Recycler frames use bottom items Intake / Received / Processing / Account. The brief lists `/recycler/intake` and `/recycler/records`, so Received maps to `/recycler/records`, and Processing and Account are additional routes.
4. Sidebars list sections the brief does not route. Each has a placeholder route so no link is broken.
5. Mobile frames show the offline banner permanently. It is a real state driven by `navigator.onLine`; no synchronization logic exists.
6. No desktop design exists for collector or recycler. Both shells switch to a sidebar layout from 1024px.
7. No tablet frames exist. 768px follows the mobile layout with wider content; verified visually only.
8. Both role-preview names and page titles come from contract role labels and translated page keys, not the frames' fixture names.

## 7. Verification

Verified 2026-09-20 in Chromium with Playwright screenshots (390px, 768px, 1440px; English and Arabic), saved under `apps/web/test-results/visual` and not committed.

| Frame | Compared visually against Figma | Notes |
| --- | --- | --- |
| scrap-trace-design-system | No | Reproduced in the showcase and checked with tests; not compared side by side |
| welcome-language | Yes | Matches |
| role-sign-in | Yes | Matches |
| privacy-consent | Yes | Matches |
| collector-home | Yes | Matches |
| mobile-collector-en | Yes | Matches |
| mobile-collector-ar | Yes (Arabic capture) | Matches |
| collector-home-arabic | No | Frame not inspected |
| account-privacy | Yes | Role reads "Collector", not "Collector Node" |
| clear-local-data | Yes | Header reads "Account", not the page title |
| mobile-recycler-en | Yes | Matches apart from placeholder image |
| recycler-home | Yes | "Under Review" badge stands in for "Awaiting Audit" |
| ProgrammeReviewerShell | Yes | GPS column uses badges |
| ProgrammeManagerShell | Yes | Matches |
| SafetyContentAdminShell | Yes | Matches |
| DataMlReviewerShell | Yes | Image placeholder is larger than the frame's image |
| ArabicProgrammeManagerShell | Yes | Arabic-Indic digits and RTL layout match |
| SharedSecurityStatesShell | Yes | Layout differs (see deviations) |

Automated checks: format, lint, typecheck, 73 web unit tests, contracts check and production build pass. Playwright covers every shell and screen with axe, no horizontal overflow at 360, 390, 768, 1280 and 1440px, no console errors, RTL, and language switching.

## 8. Intentional differences from Figma

1. **Offline banner text is dark, not white.** White on amber `#C78A12` is 2.96:1, below the 4.5:1 minimum for small text.
2. **Amber metric values use `#A15C00`.** `#C78A12` on white is 2.96:1 and fails WCAG AA for large text as measured by axe.
3. **Header reads "Connected" or "Offline", not "Connected — Synced".** Synchronization state is unknown until the offline milestone.
4. **Sign out sits in the user menu**, and the menu trigger shows an avatar and chevron instead of a fixture name such as "M. Inspector". Repeating the role text truncated on narrow desktop widths.
5. **Language control is a four-language menu.**
6. **Sidebar collapse is not implemented**; no frame shows it.
7. **Icons are lucide outlines.**
8. **Device status bar and bezel are not implemented.**
9. **Mobile header shows the navigation label** ("Home", "Intake", "Account") rather than the frame's page-specific title ("Collector Node", "Recycler Intake", "Confirm Cleared Cache"). The page heading is present for assistive technology and shown on desktop.
10. **Security states are one card per route** inside the public shell. Figma shows both cards side by side under an operational-style header with a "System Security View" badge and a static amber alert. The alert is replaced by the real offline banner because the frame's cache claim would be false.
11. **Statuses map to contract states.** "Awaiting Audit" uses `under_review`. Reviewer GPS values use the verified and unverified GPS badges.
12. **Sample-data note** ("Illustrative sample data ... not live records") appears above figures on dashboards so they are never mistaken for live data.
13. **Role-preview list uses contract labels** ("Data and model reviewer") rather than the frame's names.
14. **Welcome screen keeps the shell's brand header** in addition to the frame's title.
15. **Placeholders show route requirements** (required role and permission) on destinations that have no frame.

## 9. Screens without a Figma frame

These sidebar destinations have no frame, so they remain placeholders showing their route requirements: collector Nearby (`/collector/locations`); recycler Received (`/recycler/records`), Processing and Account; reviewer Assigned Records, Decisions Audit and System History; manager Records Ledger, Recovery Locations, Price References, System Reports (`/management/reports`) and Settings; safety Translations, Approval Queue and Published Content; ML Approved Labels, Model Information and Data Exports. Also unframed: registration (`/register`), the public landing page (`/`) and the not-found and error pages, which keep the foundation designs.

## 10. Deferred behaviour

Photo capture, QR generation and scanning, GPS verification, evidence images, audit decisions, safety-card publishing, label commits, consent persistence, local-data clearing, offline synchronization and authentication need services or storage that belong to later milestones. Navigation visibility is a usability aid; backend authorization is mandatory for every request (ADR-006).
