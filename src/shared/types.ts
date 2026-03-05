/**
 * Shared type definitions used across all modules.
 * Central type registry to keep module boundaries clean.
 */

/** Unique identifier for database entities. */
export type EntityId = string;

/** ISO 8601 timestamp string. */
export type Timestamp = string;

/** Priority levels for tasks. */
export type TaskPriority = "critical" | "high" | "medium" | "low";

/** Lifecycle states for a task. */
export type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done" | "archived";

/** Roles a user can hold within a team. */
export type UserRole = "owner" | "admin" | "member" | "viewer";

/** Notification delivery channels. */
export type NotificationChannel = "email" | "webhook" | "in_app";

/** Base fields shared by all database entities. */
export interface BaseEntity {
	/** Primary key. */
	id: EntityId;
	/** When the record was created. */
	created_at: Timestamp;
	/** When the record was last modified. */
	updated_at: Timestamp;
}

/** A registered user in the system. */
export interface User extends BaseEntity {
	email: string;
	name: string;
	password_hash: string;
	role: UserRole;
	team_id: EntityId | null;
	avatar_url: string | null;
	last_login_at: Timestamp | null;
}

/** A task within the project board. */
export interface Task extends BaseEntity {
	title: string;
	description: string | null;
	status: TaskStatus;
	priority: TaskPriority;
	assignee_id: EntityId | null;
	reporter_id: EntityId;
	team_id: EntityId;
	due_date: Timestamp | null;
	tags: string[];
	estimated_hours: number | null;
	actual_hours: number | null;
}

/** A comment on a task. */
export interface TaskComment extends BaseEntity {
	task_id: EntityId;
	author_id: EntityId;
	body: string;
	edited: boolean;
}

/** A team that groups users and tasks. */
export interface Team extends BaseEntity {
	name: string;
	slug: string;
	owner_id: EntityId;
	description: string | null;
}

/** A notification event for a user. */
export interface Notification extends BaseEntity {
	user_id: EntityId;
	channel: NotificationChannel;
	subject: string;
	body: string;
	read: boolean;
	task_id: EntityId | null;
}

/** Webhook subscription for external integrations. */
export interface WebhookSubscription extends BaseEntity {
	team_id: EntityId;
	url: string;
	secret: string;
	events: string[];
	active: boolean;
}

/** Standard API error response. */
export interface ApiError {
	code: string;
	message: string;
	details?: Record<string, unknown>;
}

/** Paginated response wrapper. */
export interface PaginatedResponse<T> {
	data: T[];
	total: number;
	page: number;
	per_page: number;
	has_more: boolean;
}
