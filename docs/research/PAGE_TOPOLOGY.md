# Page Topology

## Page Sections (top to bottom)

1. **Header/Nav** - Sticky header with logo, nav links, CTA buttons
2. **Hero Section** - Gradient background, title, features list, CTA buttons, floating badges
3. **Pain Points Section** - 3 cards with icons, titles, descriptions
4. **Features Section** - 4 cards in 2x2 grid, feature lists
5. **Highlights Section** - 6 cards in 2x3 grid, highlight lists
6. **Values Section** - Gradient background, 6 cards in 3x2 grid
7. **Cases Section** - 3 testimonial cards
8. **Pricing Section** - 3 pricing cards, featured card scaled up
9. **CTA Section** - Gradient card with title, description, buttons
10. **Footer** - 4-column grid with logo, links, contact

## Interaction Models

- **Header**: Sticky, possible shadow on scroll (needs verification)
- **Hero badges**: Positioned absolutely, static display
- **Cards**: Hover effect - translateY(-5px), shadow change
- **Buttons**: Hover effect - translateY(-2px), shadow change
- **Modal**: WeChat QR code popup, overlay with fade in
- **Navigation**: Smooth scroll to sections

## Dependencies

- Header is fixed overlay potential
- Hero has absolute positioned badges over image
- Pricing card has featured state (scaled up)
- Modal overlays entire page

## Global Styles

See DESIGN_TOKENS.md
