# Design Guidelines: Enterprise Task Management System

## Design Approach
**Selected Approach:** Design System (Material Design 3 + Enterprise Customization)

This is a complex enterprise application with information-dense interfaces (task lists, analytics, organizational hierarchy). Material Design 3 provides robust patterns for data-heavy applications while allowing customization for the specified dark theme and glassmorphism aesthetic.

**Key Principles:**
- Data clarity and scanability for task management
- Clear hierarchy for organizational structure visualization
- Efficient workflows for auction-based task assignment
- Professional, focused aesthetic for enterprise environment

## Core Design Elements

### Typography
- **Primary Font:** Inter (Google Fonts)
- **Headings:** Inter, weights 600-700
  - H1: text-3xl (Dashboard titles)
  - H2: text-2xl (Section headers)
  - H3: text-xl (Card headers, dialog titles)
  - H4: text-lg (Subsections)
- **Body Text:** Inter, weight 400
  - Base: text-base (Primary content)
  - Small: text-sm (Metadata, labels)
  - Tiny: text-xs (Timestamps, helper text)
- **Monospace (for time/numbers):** 'Roboto Mono', font-mono

### Layout System
**Spacing Units:** Tailwind units of 2, 4, 6, 8, 12, 16 (p-2, m-4, gap-6, space-y-8, etc.)

**Container Strategy:**
- Main content: max-w-7xl mx-auto px-4
- Dialog/modal content: max-w-2xl for forms, max-w-4xl for task details
- Analytics dashboards: max-w-full with inner grid constraints

**Grid Patterns:**
- Task lists: Single column on mobile, 2-column on md, 3-column on lg
- Analytics cards: grid-cols-1 md:grid-cols-2 lg:grid-cols-4
- Organizational hierarchy: Tree view on desktop, collapsible list on mobile

### Color Implementation (User-Specified)
**Primary:** #0d5257 (dark teal)
**Text:** #FFFFFF (white on dark backgrounds)
**Backgrounds:** Dark gradients and glassmorphism overlays
**Status Colors:**
- Backlog: Slate/gray tones
- In Progress: Blue (#3b82f6)
- Under Review: Amber (#f59e0b)
- Completed: Green (#10b981)
- Overdue: Red (#ef4444)

### Component Library

**Navigation**
- Sidebar navigation (desktop): Fixed left sidebar, w-64, glassmorphism background
- Mobile: Bottom tab bar or hamburger menu
- Sections: Dashboard, My Tasks, Auctions, Create Task, Reports, Administration
- Active state: Subtle highlight with primary color accent

**Task Cards**
- Card container: Glassmorphism effect (backdrop-blur-lg, semi-transparent background)
- Padding: p-6
- Border: Subtle border with primary color
- Content hierarchy:
  - Title (text-lg font-semibold)
  - Metadata row: Status badge, assignee avatar, deadline (text-sm)
  - Description preview (text-sm, 2-line truncation)
  - Footer: Time estimate, rating indicator, action buttons
- Hover state: Slight elevation increase

**Auction Task Cards** (Enhanced)
- All standard task card elements plus:
- Bidding section: Current minimum time, number of bidders
- Countdown timer (if active): Prominent display of remaining time before auto-increase
- Bid button: Primary action, disabled if already bid
- Bid list: Collapsible section showing all bids with user ratings

**Forms**
- Input fields: Dark background with light border, focus state with primary color
- Labels: text-sm font-medium, mb-2
- Required fields: Asterisk indicator
- Select dropdowns: Custom styled with primary accent
- File upload: Drag-and-drop zone with upload icon
- Form spacing: space-y-6

**Data Tables** (for analytics/reports)
- Header row: Sticky, semi-transparent background
- Row hover: Subtle highlight
- Sortable columns: Icon indicators
- Pagination: Bottom-aligned, compact controls
- Responsive: Horizontal scroll on mobile with fixed first column

**Modals/Dialogs**
- Overlay: backdrop-blur-sm with dark overlay
- Container: Glassmorphism card, max-w-2xl
- Header: Close button, title (text-2xl)
- Content: Scrollable if needed, p-6
- Footer: Action buttons right-aligned

**Rating Display**
- Visual indicator: Star icons or numerical badge
- Color-coded: Green (high), yellow (medium), red (low)
- Trend indicator: Arrow up/down for recent changes

**Organizational Hierarchy Visualization**
- Tree view: Indented lines connecting levels
- Department cards: Larger cards with summary metrics
- Expandable/collapsible sections
- User avatars with role badges

**Charts/Analytics**
- Time tracking: Bar charts showing hours per day/week
- Rating trends: Line charts
- Department comparison: Horizontal bar charts
- Task distribution: Donut/pie charts
- Responsive: Stack on mobile, side-by-side on desktop

**Chat/Comments**
- Message bubbles: Different styling for current user vs others
- Timestamp: text-xs, subtle color
- Attachment previews: Thumbnail with download link
- Input field: Sticky bottom, with attachment button

**Buttons**
- Primary: Solid fill with primary color, white text
- Secondary: Transparent with primary border
- Danger: Red for destructive actions
- Sizes: text-sm px-4 py-2 (standard), text-xs px-3 py-1.5 (small)
- States: Disabled (opacity-50), loading (spinner)

**Badges/Status Indicators**
- Pill shape: rounded-full px-3 py-1
- Size: text-xs font-medium
- Color-coded by status type

**Glassmorphism Implementation**
- backdrop-filter: blur(16px)
- Background: rgba with 10-20% opacity
- Border: 1px solid with subtle white/primary tint
- Applied to: Cards, sidebar, modals, floating elements

### Animations
**Minimal and Purposeful:**
- Page transitions: Simple fade (200ms)
- Dropdown menus: Slide down (150ms)
- Modal appearance: Scale + fade (200ms)
- Toast notifications: Slide in from top (300ms)
- Avoid: Continuous animations, complex scroll effects

## Images
This enterprise application does not require a hero image. Focus is on functional UI components and data visualization. Avatar placeholders for users should use initials with primary color background.