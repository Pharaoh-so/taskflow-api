/**
 * Notification dispatcher.
 * Routes task events to the appropriate delivery channels (email, webhook, in-app).
 */

import type { Task, EntityId, Notification } from "../shared/types.js";
import { query, queryOne } from "../shared/database.js";
import { sendEmail } from "./email.js";
import { deliverWebhook } from "./webhooks.js";
import { logger } from "../shared/logger.js";

/** Event types that trigger notifications. */
export type TaskEvent = "assigned" | "status_changed" | "commented" | "due_soon" | "overdue";

/** Create an in-app notification record. */
async function createInAppNotification(
	userId: EntityId,
	subject: string,
	body: string,
	taskId: EntityId,
): Promise<Notification> {
	return queryOne<Notification>(
		`INSERT INTO notifications (user_id, channel, subject, body, task_id)
		 VALUES ($1, 'in_app', $2, $3, $4) RETURNING *`,
		[userId, subject, body, taskId],
	);
}

/** Build a human-readable notification message for a task event. */
function buildMessage(task: Task, event: TaskEvent): { subject: string; body: string } {
	switch (event) {
		case "assigned":
			return {
				subject: `Task assigned: ${task.title}`,
				body: `You have been assigned to "${task.title}" (${task.priority} priority).`,
			};
		case "status_changed":
			return {
				subject: `Task updated: ${task.title}`,
				body: `"${task.title}" status changed to ${task.status}.`,
			};
		case "commented":
			return {
				subject: `New comment on: ${task.title}`,
				body: `A new comment was added to "${task.title}".`,
			};
		case "due_soon":
			return {
				subject: `Task due soon: ${task.title}`,
				body: `"${task.title}" is due on ${task.due_date}.`,
			};
		case "overdue":
			return {
				subject: `Task overdue: ${task.title}`,
				body: `"${task.title}" is past its due date of ${task.due_date}.`,
			};
	}
}

/** Determine which users should be notified for a task event. */
async function getNotificationRecipients(
	task: Task,
	event: TaskEvent,
): Promise<EntityId[]> {
	const recipients = new Set<EntityId>();

	// Always notify the assignee (if any)
	if (task.assignee_id) {
		recipients.add(task.assignee_id);
	}

	// Notify the reporter for status changes
	if (event === "status_changed") {
		recipients.add(task.reporter_id);
	}

	return Array.from(recipients);
}

/**
 * Send notifications for a task event.
 * Dispatches to all configured channels (in-app, email, webhook).
 * Failures are logged but don't throw — notifications are best-effort.
 */
export async function sendTaskNotification(task: Task, event: TaskEvent): Promise<void> {
	try {
		const recipients = await getNotificationRecipients(task, event);
		const { subject, body } = buildMessage(task, event);

		// In-app notifications for all recipients
		const inAppPromises = recipients.map((userId) =>
			createInAppNotification(userId, subject, body, task.id),
		);

		// Email notifications for assigned events
		if (event === "assigned" && task.assignee_id) {
			const userRows = await query<{ email: string }>(
				"SELECT email FROM users WHERE id = $1",
				[task.assignee_id],
			);
			if (userRows.length > 0) {
				inAppPromises.push(
					sendEmail(userRows[0].email, subject, body) as Promise<never>,
				);
			}
		}

		// Webhook delivery for the team
		await deliverWebhook(task.team_id, event, { task, event });

		await Promise.allSettled(inAppPromises);

		logger.debug("Notifications dispatched", {
			taskId: task.id,
			event,
			recipientCount: recipients.length,
		});
	} catch (err) {
		logger.error("Notification dispatch failed", {
			taskId: task.id,
			event,
			error: err instanceof Error ? err.message : String(err),
		});
	}
}

/** Mark a notification as read. */
export async function markNotificationRead(
	notificationId: EntityId,
	userId: EntityId,
): Promise<void> {
	await query(
		"UPDATE notifications SET read = true WHERE id = $1 AND user_id = $2",
		[notificationId, userId],
	);
}

/** Get unread notification count for a user. */
export async function getUnreadCount(userId: EntityId): Promise<number> {
	const result = await query<{ count: string }>(
		"SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND read = false",
		[userId],
	);
	return Number.parseInt(result[0].count, 10);
}
