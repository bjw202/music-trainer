# Expert Frontend Agent Memory

## Project: guitar-mp3-trainer-v2

### Stack
- React + TypeScript (Vite)
- Tailwind CSS with custom dark theme
- Zustand for state management (bpmStore, controlStore)
- Lucide React icons

### Design System
- Background: `#1A1A1A` (page), `#141414` (panel), `#1E1E1E` (border), `#2A2A2A` (disabled bg)
- Accent: `#FF6B35` (orange, active states)
- Text: `#F5F5F5` (primary), `#9CA3AF` (secondary), `#6B7280` (muted)
- Error: `#EF4444` with `#EF444419` background
- Success badge: `#22C55E` with `#22C55E26` background

### Component Patterns
- Panels use `bg-[#141414] border border-[#1E1E1E] rounded-xl p-4`
- Disabled state: `bg-[#2A2A2A] text-[#6B7280] cursor-not-allowed`
- Active/orange button: `bg-[#FF6B35] text-white hover:bg-[#FF6B35]/90`

### Pencil MCP Design Files
- `/Users/byunjungwon/Dev/my-project-01/guitar-mp3-trainer-v2/metronome-panel.pen`
  - Node `lcTlC`: Normal State frame
  - Node `yp8rf`: Analyzing State frame
  - Node `gVbXB`: Error State frame
  - Node `g1NZP`: No File (Disabled) State frame

### Pencil MCP Tips
- Font family "monospace" is invalid, use "Roboto Mono" instead
- Icon "loader-2" is not in lucide, use "refresh-cw" for spinner visual
- Icon "alert-circle" is not in lucide, use "triangle-alert" instead
- Use binding names for parents within same batch_design call
- Cannot reference bindings across different batch_design calls - use node IDs
