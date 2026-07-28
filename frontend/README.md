# 🎨 Frontend Architecture (`/frontend`)

The frontend for **FindMyDonor™** is a single-page web application built with **React**, **TypeScript**, **Vite**, **TailwindCSS**, and **Framer Motion** for smooth glassmorphic UI animations.

---

## 🧩 Views & Component Map (`/src`)

| View Identifier | Component | Purpose |
|---|---|---|
| **`landing`** | `Hero`, `StatsSection`, `LiveActivityFeed` | Home landing page with live statistics and emergency CTAs |
| **`request`** | [RequestForm.tsx](file:///c:/project/lahu/src/components/RequestForm.tsx) | Step-by-step emergency blood request creation form |
| **`tracking`** | [RequestTracking.tsx](file:///c:/project/lahu/src/components/RequestTracking.tsx) | Live match tracking page with interactive hospital map & donor response cards |
| **`donor-dashboard`** | [DonorDashboard.tsx](file:///c:/project/lahu/src/components/DonorDashboard.tsx) | Donor portal for availability toggle, cooldown timer, and match history |
| **`requester-portal`** | [RequesterPortal.tsx](file:///c:/project/lahu/src/components/RequesterPortal.tsx) | Requester dashboard for managing active requests and contacting accepted donors |
| **`hospital-dashboard`** | `HospitalDashboard.tsx` | Hospital portal for verified medical blood requests |
| **`admin-dashboard`** | `AdminDashboard.tsx` | Admin management center |

---

## 🎨 Design Tokens & Parity Rules

- **Theme & Palette**: Glassmorphic dark/light aesthetic defined in `index.css` using HSL tailored color variables (`--color-blood-*`, `--color-ink-*`).
- **Glassmorphism**: Backdrop blur filters (`backdrop-blur-md`, `glass shadow-premium`) with ambient glowing gradients.
- **Micro-interactions**: Hover effects, smooth reveal transitions via Framer Motion `motion.div`, and celebratory confetti animations upon request fulfillment.
- **Routing**: State-based active view navigation (`setActiveView('requester-portal')`) wired to top navbar and quick CTAs.

---

## 💻 Running & Building Frontend

```bash
# Start frontend dev server
npm run dev

# Build production bundle
npm run build
```
