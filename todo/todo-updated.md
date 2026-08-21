# FindMyDonor --- UI/UX & Product TODO

## Goal

Make FindMyDonor simple, professional, role-based, and easy to use for
Donors, Requesters, Institutions, and Admins.

## 1. Donor Dashboard & Profile --- Images 1--5

-   [ ] Replace the large scattered phone/WhatsApp banner with a direct
    profile-completion popup for new or incomplete donor profiles.
-   [ ] Popup should collect the required donor details in one clean
    flow:
    -   [ ] Blood group
    -   [ ] Weight
    -   [ ] Pincode
    -   [ ] Area/locality
    -   [ ] City
    -   [ ] WhatsApp number
-   [ ] WhatsApp must accept exactly 10 numeric digits.
-   [ ] Show `+91` as fixed UI text; user must not select or type the
    country code.
-   [ ] Validate the number on both client and server.
-   [ ] Keep medical/profile data and contact data logically grouped.
-   [ ] Remove duplicated fields and unnecessary separate cards.
-   [ ] After completion, do not repeatedly show the popup unless
    required data becomes incomplete.
-   [ ] Rework dashboard hierarchy to:
    `Profile Status → Availability → Emergency Actions → Matches/Donations`
-   [ ] Fix excessive empty space, inconsistent card widths, poor
    alignment, and scattered sections.
-   [ ] Keep the existing FindMyDonor red/white identity but make
    spacing, typography, card sizing, shadows, and alignment consistent.
-   [ ] Make the dashboard responsive and balanced on desktop and
    mobile.

## 2. Requester Registration & Request Flow --- Images 6--9

-   [ ] Simplify requester registration and clearly mark required vs
    optional fields.
-   [ ] Collect only information actually required to create and
    broadcast a blood request.
-   [ ] Use short, clear labels and useful validation messages.
-   [ ] Keep the emergency request flow sequential and easy to complete.
-   [ ] Recommended request flow:
    `Blood Group → Units Required → Patient Age/Basic Details → Pincode/Area → Urgency → Contact → Broadcast`
-   [ ] Clearly distinguish Draft, Active/Broadcasting, Donor Responses,
    Fulfilled, Expired, and Cancelled.
-   [ ] After broadcasting, clearly show what is happening:
    `Request Created → Finding Compatible Donors → Donors Notified → Responses → Donor Accepted → Fulfilled`
-   [ ] Show matched/active donor responses in the requester dashboard.
-   [ ] Show request progress and current status in one place.

## 3. Public Blood Request Detail Page

-   [ ] Create a dedicated public single-page view for every active
    blood request.
-   [ ] Show safe public information such as:
    -   [ ] Blood group
    -   [ ] Units required
    -   [ ] Patient age, where appropriate
    -   [ ] Pincode/area
    -   [ ] Urgency
    -   [ ] Request status
    -   [ ] Time/date posted
    -   [ ] Matching donor availability
-   [ ] Do not publicly expose phone number, WhatsApp, email, exact
    address, or other sensitive personal information.
-   [ ] Protected requester/contact information must appear locked.
-   [ ] Unauthenticated users who try to unlock protected information
    must be asked to sign up or log in.
-   [ ] Enforce this protection server-side, not only by hiding UI
    elements.
-   [ ] The page must remain useful even before login.

## 4. Live Donor Availability & Discovery --- BloodDonor.in Reference

-   [ ] Add a clean live availability section showing active eligible
    donors by blood group.
-   [ ] Show real-time counts from actual donor records, not
    dummy/static numbers.
-   [ ] A donor count must represent donors who are currently eligible,
    available, matching the required blood group, and within the
    applicable location/matching rules.
-   [ ] Example: `O− — 6 active donors nearby`
-   [ ] Allow users to understand which blood groups currently have
    nearby donors at a glance.
-   [ ] Use blood-group availability cards as a UX reference from
    BloodDonor.in, but do not copy its branding, layout, text, or
    implementation.
-   [ ] Donor discovery must protect personal information.
-   [ ] Public donor preview may show only safe information such as:
    -   [ ] Blood group
    -   [ ] Approximate location/pincode
    -   [ ] Availability
    -   [ ] Verification status
-   [ ] Lock contact/full profile information for unauthenticated users.
-   [ ] Require sign-up/login before protected donor information can be
    accessed.
-   [ ] Donor availability counts must update when donor availability
    changes.

## 5. Institutional Registration --- Image 10

-   [ ] Combine Hospital, Blood Bank, and NGO registration into one
    Institutional Partner entry point.
-   [ ] First ask institution type: `Hospital / Blood Bank / NGO`
-   [ ] Use one common registration flow and show only
    institution-specific fields when needed.
-   [ ] Registration must create a `Pending Approval` institution.
-   [ ] Institution must not become active until Admin approves it.
-   [ ] Admin must be able to:
    -   [ ] Review
    -   [ ] Approve
    -   [ ] Reject
    -   [ ] Suspend
    -   [ ] Reactivate
-   [ ] Clearly show institution approval status.

## 6. Institutional Dashboard --- Lightweight CRM

-   [ ] Design a professional but lightweight Institutional Dashboard.
-   [ ] Do not overload institutions with unnecessary features because
    the number of institutions will be smaller.
-   [ ] Dashboard should answer:
    `What is happening in my blood network right now?`
-   [ ] Provide access to:
    -   [ ] Blood inventory
    -   [ ] Blood-group-wise stock
    -   [ ] Available donors
    -   [ ] Nearby emergency requests
    -   [ ] Active matches
    -   [ ] Pending requests
    -   [ ] Fulfilled cases
    -   [ ] Recent activity
    -   [ ] Institution profile/status
-   [ ] Inventory should clearly show:
    `Blood Group → Units Available → Last Updated → Status`
-   [ ] Show relevant donor/request/match information for that
    institution.
-   [ ] Keep the dashboard operational and CRM-like.
-   [ ] Avoid unnecessary gamification or decorative widgets.

## 7. Admin Panel

-   [ ] Create one central Admin Panel with complete platform visibility
    and management.
-   [ ] Main sections:
    -   [ ] Donors
    -   [ ] Requesters
    -   [ ] Institutions
    -   [ ] Blood Requests
    -   [ ] Matches
    -   [ ] Donations
    -   [ ] Inventory
    -   [ ] Reports/Activity
-   [ ] Provide search, filtering, sorting, and status views.
-   [ ] Admin must be able to review and manage user records.
-   [ ] Admin must be able to approve, suspend, deactivate, and restore
    accounts where applicable.
-   [ ] Add a dedicated institution approval queue.
-   [ ] Show:
    -   [ ] Active broadcasts
    -   [ ] Matched donors
    -   [ ] Fulfilled requests
    -   [ ] Expired requests
    -   [ ] Cancelled/closed cases
-   [ ] Important admin actions should have clear status/audit
    information.
-   [ ] Sensitive information available to Admin must never
    automatically become visible to normal users.

## 8. Authentication & Google Sign-In --- Image 11

-   [ ] Remove the visible Supabase project hostname from the
    user-facing Google sign-in experience.
-   [ ] Google OAuth should present FindMyDonor as the product
    experience instead of exposing the Supabase project URL
    unnecessarily.
-   [ ] Verify Google OAuth provider configuration, redirect URLs,
    callback URLs, allowed origins, and production environment
    variables.
-   [ ] Test:
    -   [ ] Google login
    -   [ ] Logout
    -   [ ] Session restoration
    -   [ ] Expired session
    -   [ ] Correct role-based redirect
    -   [ ] Production domain redirect
-   [ ] Do not expose internal infrastructure details unnecessarily in
    user-facing authentication.

## 9. Track Match / Track Code --- Image 11

-   [ ] Fix `Track Match` navigation.
-   [ ] Fix `Track Code` / blood tracking so a valid tracking code
    retrieves the correct request/match.
-   [ ] Verify the complete tracking flow from request creation to
    tracking.
-   [ ] Handle:
    -   [ ] Valid code
    -   [ ] Invalid code
    -   [ ] Missing code
    -   [ ] Expired code
    -   [ ] Fulfilled request
    -   [ ] Cancelled request
-   [ ] Show clear user-facing errors instead of silent failures.
-   [ ] Ensure users cannot access another user's protected tracking
    information.
-   [ ] Verify tracking works after refresh and session restoration.

## 10. Remove Unnecessary UI --- Images 12--13

-   [ ] Remove sections that do not directly help users:
    `Find Blood / Request Blood / Donate / Track / Manage Account`
-   [ ] Remove repetitive decorative sections.
-   [ ] Remove unnecessary homepage/dashboard content that increases
    page length without adding functionality.
-   [ ] Reduce visual noise and excessive cards.
-   [ ] Keep useful trust, availability, matching, emergency, and
    navigation information.
-   [ ] Every remaining section must have a clear user purpose.
-   [ ] Prefer one strong useful section over several duplicated
    sections.

## 11. Role-Based Information Architecture

### Donor

-   [ ] Profile
-   [ ] Availability
-   [ ] Emergency requests
-   [ ] Matches
-   [ ] Donation history
-   [ ] Contact settings

### Requester

-   [ ] Create request
-   [ ] Active broadcasts
-   [ ] Donor responses
-   [ ] Request tracking
-   [ ] Fulfilled cases
-   [ ] Request history

### Institution

-   [ ] Inventory
-   [ ] Donors
-   [ ] Requests
-   [ ] Matches
-   [ ] Fulfilled cases
-   [ ] Activity
-   [ ] Institution profile

### Admin

-   [ ] Full platform overview
-   [ ] Users
-   [ ] Institutions
-   [ ] Requests
-   [ ] Matches
-   [ ] Donations
-   [ ] Inventory
-   [ ] Approvals
-   [ ] Reports/activity
-   [ ] Account management

## 12. Final UI/UX Quality

-   [ ] Use one consistent spacing system.
-   [ ] Standardize buttons, input heights, labels, icons, card radius,
    shadows, and typography.
-   [ ] Fix the scattered appearance visible in the screenshots.
-   [ ] Reduce excessive vertical gaps and unnecessary whitespace.
-   [ ] Keep related information together.
-   [ ] Make primary actions visually obvious.
-   [ ] Use clear empty, loading, success, error, locked, pending, and
    disabled states.
-   [ ] Keep desktop layout balanced.
-   [ ] Ensure mobile layouts stack correctly.
-   [ ] Avoid adding features just to make the dashboard look full.

## 13. Security & Data Rules

-   [ ] Treat phone, WhatsApp, email, exact address, and personal
    requester/donor details as protected data.
-   [ ] Never rely only on frontend hiding for protected information.
-   [ ] Enforce authorization on the backend.
-   [ ] Validate all user input on client and server.
-   [ ] Ensure donor/requester/institution users cannot access another
    user's protected records.
-   [ ] Do not expose internal Supabase/project infrastructure
    unnecessarily.
-   [ ] Keep admin-only information strictly admin-only.

## 14. End-to-End Acceptance Tests

-   [ ] New donor → profile popup → complete profile → dashboard.
-   [ ] Existing donor → dashboard → update availability/contact
    information.
-   [ ] Donor WhatsApp → exactly 10 digits → save successfully.
-   [ ] Requester → simple registration → create request.
-   [ ] Requester → broadcast → compatible nearby donors notified.
-   [ ] Donor → receives matching request → accepts/responds.
-   [ ] Requester → sees donor response → tracks request.
-   [ ] Public request page → safe information visible → protected
    details locked.
-   [ ] New user → tries to unlock → sign up/login required.
-   [ ] Institution → select type → register → pending approval.
-   [ ] Admin → review institution → approve/reject/suspend/reactivate.
-   [ ] Approved institution → institutional dashboard →
    inventory/donors/requests/matches visible.
-   [ ] Admin → complete platform data visible and manageable.
-   [ ] Google login → production FindMyDonor flow → correct redirect.
-   [ ] Track code → valid code returns correct request/match.
-   [ ] Invalid/expired tracking code → clear error.
-   [ ] Donor availability → real active counts update correctly.
-   [ ] Mobile and desktop → no broken layout or scattered content.

## 15. Done When

-   [ ] The UI looks like one professional product instead of separate
    unrelated screens.
-   [ ] Each role immediately understands what they need to do.
-   [ ] Donor and requester forms can be completed quickly without
    unnecessary fields.
-   [ ] Real donor availability is clearly visible without exposing
    private data.
-   [ ] Public blood requests are useful but privacy-safe.
-   [ ] Institutions work through an approval-based CRM-style dashboard.
-   [ ] Admin has complete controlled visibility and management.
-   [ ] Google authentication no longer exposes unnecessary Supabase
    branding/infrastructure.
-   [ ] Track Match and Track Code work end-to-end.
-   [ ] Unnecessary sections from Images 12--13 are removed.
-   [ ] Lint, typecheck, build, and relevant tests pass.

## Reference

BloodDonor.in was used only as a UX reference for donor discovery,
blood-group availability, search/filtering, and protected donor contact
patterns. Do not copy its branding, layout, text, or implementation.
