# Header Specification

## Overview
- **Target file:** `src/components/Header.tsx`
- **Sticky header** with white background and bottom border
- **Interaction model:** static (no scroll change in provided HTML)

## Layout
- Flexbox: space-between, center aligned
- 3 sections: logo (left), nav links (center), action buttons (right)
- Wraps on mobile (flex-wrap, gap 24px)

## Computed Styles
### Container (header)
- position: sticky, top: 0, z-index: 999
- background: #FFFFFF, border-bottom: 1px solid var(--gray-4)
- padding: 16px 0

### Logo
- font-size: 28px, font-weight: 800, color: var(--primary) (#165DFF)
- text-decoration: none

### Nav Links
- display: flex, gap: 32px
- links: color: var(--gray-1) (#4E5969), font-size: 15px, font-weight: 500
- hover: color: var(--primary)

### Action Buttons
- display: flex, gap: 8px
- Uses .btn, .btn-primary, .btn-outline classes

## Responsive Behavior
- **Desktop (1440px):** All 3 sections in one row
- **Mobile (~576px):** nav-links hidden (display: none), stacked layout
- **Breakpoint:** ~992px for nav-links hide

## Text Content (verbatim)
- Logo text: "Adx Kit"
- Nav links: 核心功能, 系统亮点, 系统价值, 客户案例, 价格方案
- Buttons: 立即购买, 立即咨询, 登录系统
