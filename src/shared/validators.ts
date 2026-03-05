/**
 * Zod schemas for request validation.
 * Shared across route handlers to ensure consistent input validation.
 */

import { z } from "zod";

/** Valid email format. */
export const emailSchema = z.string().email("Invalid email format");

/** Password: 8+ chars, at least one uppercase, one lowercase, one digit. */
export const passwordSchema = z
	.string()
	.min(8, "Password must be at least 8 characters")
	.regex(/[A-Z]/, "Password must contain an uppercase letter")
	.regex(/[a-z]/, "Password must contain a lowercase letter")
	.regex(/[0-9]/, "Password must contain a digit");

/** Pagination query params. */
export const paginationSchema = z.object({
	page: z.coerce.number().int().min(1).default(1),
	per_page: z.coerce.number().int().min(1).max(100).default(20),
});

/** Task creation payload. */
export const createTaskSchema = z.object({
	title: z.string().min(1).max(200),
	description: z.string().max(5000).nullable().default(null),
	priority: z.enum(["critical", "high", "medium", "low"]).default("medium"),
	assignee_id: z.string().uuid().nullable().default(null),
	due_date: z.string().datetime().nullable().default(null),
	tags: z.array(z.string().max(50)).max(10).default([]),
	estimated_hours: z.number().positive().nullable().default(null),
});

/** Task update payload — all fields optional. */
export const updateTaskSchema = createTaskSchema.partial().extend({
	status: z.enum(["backlog", "todo", "in_progress", "review", "done", "archived"]).optional(),
	actual_hours: z.number().min(0).nullable().optional(),
});

/** User registration payload. */
export const registerUserSchema = z.object({
	email: emailSchema,
	password: passwordSchema,
	name: z.string().min(1).max(100),
});

/** Login payload. */
export const loginSchema = z.object({
	email: emailSchema,
	password: z.string().min(1),
});

/** Team creation payload. */
export const createTeamSchema = z.object({
	name: z.string().min(1).max(100),
	description: z.string().max(500).nullable().default(null),
});

/** Comment creation payload. */
export const createCommentSchema = z.object({
	body: z.string().min(1).max(10_000),
});

/** Webhook subscription payload. */
export const createWebhookSchema = z.object({
	url: z.string().url(),
	events: z.array(z.string()).min(1),
});
