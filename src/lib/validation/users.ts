import { z } from "zod";
import { ROLES } from "@/lib/auth/permissions";

export const passwordSchema = z
  .string()
  .min(12, "Password must be at least 12 characters")
  .max(128, "Password must be at most 128 characters")
  .refine((v) => /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v), "Use upper- and lower-case letters and at least one number");

const email = z.string().trim().toLowerCase().max(254).email("Enter a valid email address");

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password").max(128),
});

export const createUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email,
  role: z.enum(ROLES),
  password: passwordSchema,
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  role: z.enum(ROLES),
  isActive: z.boolean(),
});

export const resetPasswordSchema = z.object({ password: passwordSchema });

export const changeOwnPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });
