// Zod schemas for Phase 4 — Account Settings + Institution gates.
// Additive only; mirrors the frozen Rev 3 architecture.
import { z } from "./index";

const emailField = z
  .string({ message: "Valid email address required." })
  .trim()
  .toLowerCase()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Valid email address required.");

const tokenField = z.string().min(1, "Verification token is required.");

const institutionType = z.enum(["hospital", "ngo", "blood_bank", "other"], {
  message: "Select a valid institution type.",
});

const pincodeField = z
  .string({ message: "Pincode is required." })
  .regex(/^[0-9]{6}$/, "Enter a valid 6-digit pincode.");

// ─── POST /institutions/register ─────────────────────────────────────────────
export const institutionRegisterSchema = z.object({
  type: institutionType,
  orgName: z.string({ message: "Organisation name is required." }).trim().min(1, "Organisation name is required."),
  registrationNumber: z.string({ message: "Registration number is required." }).trim().min(1, "Registration number is required."),
  contactPerson: z.string({ message: "Contact person is required." }).trim().min(1, "Contact person is required."),
  phone: z.string({ message: "Phone number is required." }).min(1, "Phone number is required."),
  email: emailField,
  address: z.string().trim().optional(),
  city: z.string({ message: "City is required." }).trim().min(1, "City is required."),
  pincode: pincodeField,
});

// ─── POST /account/wa-verify (WhatsApp number verification completion) ───────
export const whatsappVerifySchema = z.object({
  verificationToken: tokenField,
  phone: z.string({ message: "Phone number is required." }).min(1, "Phone number is required."),
});

// ─── POST /account/change-whatsapp ────────────────────────────────────────────
export const changeWhatsappSchema = z.object({
  verificationToken: tokenField,
  newPhone: z.string({ message: "New WhatsApp number is required." }).min(1, "New WhatsApp number is required."),
});

// ─── POST /account/change-email ───────────────────────────────────────────────
export const changeEmailSchema = z.object({
  verificationToken: tokenField,
  newEmail: emailField,
});

// ─── POST /account/link-google ────────────────────────────────────────────────
export const linkGoogleSchema = z.object({
  email: emailField,
});

export type InstitutionRegisterInput = z.infer<typeof institutionRegisterSchema>;
export type WhatsappVerifyInput = z.infer<typeof whatsappVerifySchema>;
export type ChangeWhatsappInput = z.infer<typeof changeWhatsappSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;
export type LinkGoogleInput = z.infer<typeof linkGoogleSchema>;
