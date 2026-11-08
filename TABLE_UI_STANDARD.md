# 4Ds Trading Studio — Canonical Table UI Model (v1)

**Status:** Design and implementation contract, grounded in existing Portfolio Simulator. This document is the source of truth for all future table work. It does **not** claim every table has already migrated.

## Before any table change (mandatory)
1. Read this file and AGENTS.md, then inspect the *actual existing table implementation* and its saved preferences before editing. Do not invent a second style.
2. Reuse the Portfolio Simulator's existing interaction patterns; preserve stable column keys, data semantics, saved settings, and user choices.
3. Determine whether a table has colspans, nested headers, dynamic rerendering, sticky columns, custom sorting or mobile layouts. Adapt without breaking existing handlers.
4. Test desktop pointer, tablet touch, keyboard, refresh persistence, pagination, sorting and checkboxes. Report unverified coverage accurately.

## Reference implementation — Portfolio Simulator
Source: `portfolio-simulator.html`.
- **Touch + mouse column dragging:** `enableDirectTableHeaderDrag(table,onDrop,keepFirst)` uses pointer events, pointer capture, hit-testing, and drag threshold. Use this behavior, **not HTML5 drag/drop** as the standard (unreliable on touch). For draggable filter-list items, see `enableColumnPointerReorder(container,selector,getId,onMove)`.
- **Compact column filter:** `addJourneyColumnFilters()` creates a small `☷` button on the **upper-right edge of the table**, opens a compact popup, supports category/manual visibility choices, and persists column order/visibility under `studio-journey-columns-v2-<table-id>`. Filter choice order and physical column order are independent.
- **Cash flow:** `cash-table-shell`, `cash-table-columns-trigger`, `cashColumnsPanel`, `cashColumnOrder`, `moveCashColumn`, `saveCashTablePrefs()`. Keep the filter trigger at top right, not a full-width filter bar.
- **Headers:** `phaseColumnDescriptions` provides full explanations for compact headers. `studio-compact-table-headers.js` provides short labels and hover titles, but **hover-only is insufficient** for touch; all new tables must offer a tap-accessible explanation.
- **Paging:** reuse compact Rows selector and previous/next/page count patterns from existing Portfolio Simulator tables; store per-table preference and sort before paging.

## Required default table behavior
| Feature | Canonical behavior |
|---|---|
| Header text | Short (ideally <=12 characters), unambiguous; full explanation on hover, focus and tap via ⓘ or header help. Include units and exact metric meaning. |
| Column drag | Drag **header itself** left/right with pointer events on mouse and touch, showing drop target; accessible move-left/right alternative. Preserve order on rerender and refresh. |
| Filter trigger | Small `☷` button at **upper right** of table; popup with **Category** and **Manual** filter modes, not large permanent controls. Filter never silently reorders columns. |
| Sorting | Where meaningful, click/tap sortable header to toggle ↑/↓. Sort complete dataset before paging; show current direction and persist. Don't intercept help icon clicks as sort. |
| Paging | Compact rows-per-page + ‹ current/total ›; remember per table; no giant panels. |
| Selection | Checkbox selection remains stable by row ID across sort, paging, filters, refresh. |
| Persistence | Stable table IDs and stable column IDs; preserve user-specific storage namespace if already used. Do not replace a prior preference schema without migration. |
| Mobile/tablet | Touch drag and tappable help/filter/sort; avoid tiny hit targets, full-screen popups, or horizontal scroll traps. |
| Data | UI-only changes must never mutate simulation formulas, risk rules, account choices, or trade history. |

## Shared component architecture (target)
- **Table schema:** `tableId`, `columns: [{id,label,help,sortable,category,defaultVisible}]`, stable row ID, row data, current page, selected IDs.
- **Controller:** single reusable implementation of header help, pointer drag, column visibility, sorting, pagination, persistence; rendering adapters for plain DOM tables and existing render functions.
- **Migration:** Inventory each table and migrate individually after checking conflicts. Do not apply blind DOM column shuffling to tables with rowspan/colspan or virtualized rows.
- **Regression fixtures:** reorder on desktop/tablet; refresh; filter then drag; sort then page; select across pages; open help on touch; preserve formula results and table-specific settings.

## Current migration status
- **Portfolio Simulator:** canonical reference patterns already present; not all its tables necessarily share one component.
- **Scenario Optimizer** (`studio-scenario-discovery.js`): compact paging, header help, sorting and saved column order exist. Its current native HTML5 drag/drop and visible arrow controls are **not yet identical** to Portfolio Simulator pointer-drag/filter UI. Align it with the canonical model before declaring complete.
- **Other tables:** not audited or migrated as a whole. Track each migration explicitly.

## Change log
- 2026-11-08: established source-of-truth table model in response to request for one consistent, reusable UI system.
