# Task #4: UI/UX Design - Implementation Plan

## Overview
Create Pencil MCP design artifacts for the Music Trainer application (Phase 1 MVP).

## Design Approach

### Tools & Workflow
Use Pencil MCP server tools to create professional design files:

| Step | Pencil Tool | Purpose |
|------|--------------|---------|
| Document Setup | `open_document()` | Create/open .pen files |
| Guidelines | `get_guidelines(topic="tailwind")` | Reference Tailwind styling |
| Design Creation | `batch_design(operations)` | Create components (max 25 ops/call) |
| Validation | `get_screenshot(nodeId)` | Periodic visual verification |
| Theming | `get_variables()`, `set_variables()` | Define theme variables |
| Layout Check | `snapshot_layout()` | Verify layout structure |

### Workflow Sequence
1. **open_document** - Open/create each .pen file
2. **get_guidelines** - Review Tailwind guidelines
3. **batch_design** - Insert(I) operations to create components
4. **get_screenshot** - Validate visual output
5. **batch_design** - Update(U) operations for refinement
6. **get_variables** - Extract global variables
7. **set_variables** - Define theme variables

## Files to Create

### 1. `design/player-layout.pen`
**Purpose**: Complete player layout structure

**Component Hierarchy**:
```
PlayerContainer (Desktop: 1200x800, Mobile: 375x812)
├── Header (title, track info)
├── WaveformArea (waveform, playhead, loop region)
├── ControlsPanel (playback controls, volume, A-B loop)
└── Footer (time display, status)
```

**Viewports**:
- Desktop: 1200x800px
- Mobile: 375x812px

### 2. `design/controls-components.pen`
**Purpose**: Reusable control components library

**Component List**:

| Component | States | Variants |
|-----------|--------|----------|
| PlayButton | Default, Hover, Active, Disabled | Icon only, Icon+Label |
| PauseButton | Default, Hover, Active, Disabled | Icon only, Icon+Label |
| StopButton | Default, Hover, Active, Disabled | Icon only, Icon+Label |
| VolumeSlider | Default, Hover, Active | Vertical, Horizontal |
| LoopAButton | Inactive, Active (A set) | Icon only |
| LoopBButton | Inactive, Active (B set) | Icon only |
| LoopToggle | Off, On (looping) | Toggle switch |
| MuteButton | Unmuted, Muted | Icon only |

### 3. `design/waveform-theme.pen`
**Purpose**: Waveform visualization theme

**Elements**:
```
WaveformContainer
├── WaveformBackground (#1a1a1a)
├── WaveformLine (#007aff, amplitude based)
├── Playhead (vertical line, #007aff)
├── LoopRegion (semi-transparent #34c759 overlay)
├── TimeMarkers (0:00, 0:30, 1:00, etc.)
└── ProgressFill (#007aff, 30% opacity)
```

## Design System Details

### Color Palette (Dark Theme)

| Category | Name | Hex | RGB | Usage |
|----------|------|-----|-----|-------|
| Background | bg-primary | #1a1a1a | rgb(26,26,26) | Main background |
| Background | bg-secondary | #2a2a2a | rgb(42,42,42) | Panel background |
| Text | text-primary | #e0e0e0 | rgb(224,224,224) | Primary text |
| Text | text-secondary | #a0a0a0 | rgb(160,160,160) | Secondary text |
| Accent | accent-blue | #007aff | rgb(0,122,255) | Play, Focus, Primary |
| Accent | accent-red | #ff3b30 | rgb(255,59,48) | Stop, Error |
| Accent | accent-green | #34c759 | rgb(52,199,89) | Loop Active |
| Border | border-default | #3a3a3a | rgb(58,58,58) | Default border |
| Border | border-focus | #007aff | rgb(0,122,255) | Focus border |

### Typography

| Style | Size | Weight | Line-height | Letter-spacing |
|--------|-------|--------|-------------|----------------|
| Headline | 24px | Semibold (600) | 1.2 | -0.5px |
| Subheading | 18px | Medium (500) | 1.3 | -0.25px |
| Body | 16px | Regular (400) | 1.5 | 0 |
| Caption | 12px | Regular (400) | 1.4 | 0 |
| Button | 14px | Medium (500) | 1 | 0.25px |

### Spacing Scale

| Token | Value | Usage |
|--------|-------|-------|
| space-xs | 4px | Icon padding, small gaps |
| space-sm | 8px | Related elements |
| space-md | 16px | Component internal |
| space-lg | 24px | Section spacing |
| space-xl | 32px | Major regions |
| space-2xl | 48px | Page level |

### Border Radius

| Token | Value | Usage |
|--------|-------|-------|
| radius-sm | 4px | Small buttons, inputs |
| radius-md | 8px | Regular buttons, cards |
| radius-lg | 12px | Large buttons, panels |
| radius-full | 9999px | Pills, round buttons |

### Shadows

| Token | Value | Usage |
|--------|-------|-------|
| shadow-sm | 0 1px 2px rgba(0,0,0,0.3) | Small elements |
| shadow-md | 0 4px 8px rgba(0,0,0,0.4) | Cards, panels |
| shadow-lg | 0 8px 16px rgba(0,0,0,0.5) | Modals, dropdowns |

### Animations

| Property | Value | Usage |
|----------|-------|-------|
| transition | 150ms ease-in-out | All interactive elements |
| hover-scale | scale(1.05) | Button hover |
| active-scale | scale(0.98) | Button active |
| focus-ring | 0 0 0 2px #007aff | Focus indicator |

## Responsive Breakpoints

| Breakpoint | Size | Target |
|------------|-------|--------|
| Mobile | < 640px | Small devices |
| Tablet | 640px - 1024px | Medium devices |
| Desktop | > 1024px | Large devices |

## Timeline & Deliverables

### Execution Steps

| Step | Task | Dependency | Est. Time |
|------|------|-------------|------------|
| 0 | Wait for Task #1 completion | Project initialization | - |
| 1 | Verify design/ directory | - | 1 min |
| 2 | Create player-layout.pen | - | 10 min |
| 3 | Create controls-components.pen | - | 15 min |
| 4 | Create waveform-theme.pen | - | 10 min |
| 5 | Extract and define design tokens | Steps 2-4 complete | 5 min |
| 6 | Send specs to frontend-dev | Steps 2-5 complete | 5 min |
| 7 | Mark Task #4 complete | Step 6 complete | 2 min |

### Deliverables

1. **Pencil .pen files** (3 files)
   - `design/player-layout.pen`
   - `design/controls-components.pen`
   - `design/waveform-theme.pen`

2. **Design Tokens** (Pencil variables)
   - Colors, typography, spacing, radius, shadows

3. **Component Specifications** (for frontend-dev)
   - Props, States, Variants
   - Tailwind config mapping

4. **Accessibility Documentation**
   - WCAG 2.1 AA compliance checklist

5. **Screenshots**
   - Desktop view (1200x800)
   - Mobile view (375x812)
   - Component state screenshots

## Accessibility (WCAG 2.1 AA)

| Criterion | Requirement | Compliance |
|-----------|-------------|------------|
| Contrast | 4.5:1 (Normal), 3:1 (Large) | All text verified |
| Touch Targets | 44x44px minimum | All interactive elements |
| Focus | Visible focus indicator | 2px solid #007aff |
| Color | Not sole information source | Icon + text combinations |

## Dependencies & Blockers

### Dependencies
- **Task #1** (Project Initialization): design/ directory creation required

### Blockers
- Cannot create files until Task #1 completes
- Pencil MCP server must be running

## Coordination

### Before Implementation
- Wait for Task #1 completion
- Verify design/ directory exists

### During Implementation
- Create all 3 .pen files sequentially
- Validate with screenshots after each file

### After Implementation
- Send specifications to frontend-dev via SendMessage
- Mark Task #4 complete via TaskUpdate
- Proceed to available tasks

---

**Plan Version**: 1.0
**Date**: 2026-02-14
**Agent**: designer
**Task**: Task #4 (UI/UX Design)
