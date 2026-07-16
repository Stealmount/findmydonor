# Blood Connect Project Rules & Engineering Guidelines

These rules apply to all tasks and code modifications within the `blood-o-1` project workspace.

## 1. Visual Parity with Raktdaan Frontend
- **Design Aesthetic**: All public landing page components must follow the sleek, modern glassmorphic aesthetic defined in `raktdaan` (`--color-blood-*`, `--color-ink-*`, `.ambient-bg`, `.glass`, `.btn-glow`).
- **Free Community Platform**: Never include or reintroduce commercial membership or hospital pricing tiers (`Pricing.tsx` is permanently excluded).
- **Interactive Animations**: Use `framer-motion` and `lucide-react` for smooth animations, reveals, and micro-interactions.

## 2. Preservation of Working Interactive Concepts (`blood-o-1`)
- **Donor System**: Always maintain full functional compatibility with `DonorRegistration.tsx` (`donor-register`) and `DonorDashboard.tsx` (`donor-dashboard`), including pincode matching, availability status, and 60-day safety cooldown tracking.
- **Requester System**: Always maintain full functional compatibility with `RequestForm.tsx` (`request`) and `RequesterPortal.tsx` (`requester-portal`).
- **Live Match Tracking**: Maintain real-time tracking via `RequestTracking.tsx` (`tracking`).
- **Live Notification Simulator**: Never remove or disable `NotificationSimulator.tsx`. It must remain accessible as a floating gateway in the bottom-right corner across all views for testing real-time emergency broadcasts and cooldown replies.

## 3. Navigation & Call-to-Action Wiring
- Never leave display CTAs as dead links (`href="#"`).
- Always wire CTAs (`"Request blood now"`, `"Become a volunteer donor"`, `"Sign in"`, `"Track request"`) directly to `onNavigate` callbacks triggering `setActiveView` in `App.tsx`.

## 4. Code Quality & TypeScript Rigor
- Ensure all components pass strict TypeScript type checks without implicit `any` errors.
- Preserve existing code comments and functional documentation unless explicitly instructed to change them.
