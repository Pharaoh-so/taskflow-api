/**
 * Task data access layer.
 * Handles CRUD, status transitions, and assignment logic.
 */

import { query, queryOne, queryMaybe, withTransaction } from "../shared/database.js";
import type { Task, TaskComment, EntityId, PaginatedResponse, TaskStatus } from "../shared/types.js";
import { NotFoundError, ValidationError } from "../shared/errors.js";
import { sendTaskNotification } from "../notifications/dispatcher.js";

/** Valid status transitions — enforces a linear workflow. */
const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
	backlog: ["todo"],
	todo: ["in_progress", "backlog"],
	in_progress: ["review", "todo"],
	review: ["done", "in_progress"],
	done: ["archived", "in_progress"],
	archived: [],
};

/** Create a new task in a team. */
export async function createTask(
	data: {
		title: string;
		description: string | null;
		priority: string;
		assignee_id: string | null;
		due_date: string | null;
		tags: string[];
		estimated_hours: number | null;
	},
	reporterId: EntityId,
	teamId: EntityId,
): Promise<Task> {
	const task = await queryOne<Task>(
		`INSERT INTO tasks (title, description, priority, assignee_id, reporter_id, team_id, due_date, tags, estimated_hours, status)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'backlog')
		 RETURNING *`,
		[
			data.title,
			data.description,
			data.priority,
			data.assignee_id,
			reporterId,
			teamId,
			data.due_date,
			data.tags,
			data.estimated_hours,
		],
	);

	// Notify assignee if assigned on creation
	if (task.assignee_id) {
		await sendTaskNotification(task, "assigned");
	}

	return task;
}

/** Get a task by ID. Throws NotFoundError if not found. */
export async function getTaskById(id: EntityId): Promise<Task> {
	const task = await queryMaybe<Task>("SELECT * FROM tasks WHERE id = $1", [id]);
	if (!task) throw new NotFoundError("Task", id);
	return task;
}

/** List tasks with pagination and optional filters. */
export async function listTasks(
	teamId: EntityId,
	filters: {
		status?: TaskStatus;
		assignee_id?: EntityId;
		priority?: string;
		page: number;
		per_page: number;
	},
): Promise<PaginatedResponse<Task>> {
	const conditions = ["team_id = $1"];
	const params: unknown[] = [teamId];
	let paramIndex = 2;

	if (filters.status) {
		conditions.push(`status = $${paramIndex}`);
		params.push(filters.status);
		paramIndex++;
	}

	if (filters.assignee_id) {
		conditions.push(`assignee_id = $${paramIndex}`);
		params.push(filters.assignee_id);
		paramIndex++;
	}

	if (filters.priority) {
		conditions.push(`priority = $${paramIndex}`);
		params.push(filters.priority);
		paramIndex++;
	}

	const whereClause = `WHERE ${conditions.join(" AND ")}`;
	const offset = (filters.page - 1) * filters.per_page;

	params.push(filters.per_page, offset);

	const [tasks, countResult] = await Promise.all([
		query<Task>(
			`SELECT * FROM tasks ${whereClause}
			 ORDER BY CASE priority WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 END,
			 created_at DESC
			 LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
			params,
		),
		query<{ count: string }>(
			`SELECT COUNT(*) as count FROM tasks ${whereClause}`,
			params.slice(0, paramIndex - 1),
		),
	]);

	const total = Number.parseInt(countResult[0].count, 10);

	return {
		data: tasks,
		total,
		page: filters.page,
		per_page: filters.per_page,
		has_more: offset + filters.per_page < total,
	};
}

/** Update task fields. Validates status transitions. */
export async function updateTask(
	id: EntityId,
	data: Partial<Task>,
): Promise<Task> {
	const existing = await getTaskById(id);

	// Validate status transition if status is being changed
	if (data.status && data.status !== existing.status) {
		const allowed = VALID_TRANSITIONS[existing.status];
		if (!allowed.includes(data.status)) {
			throw new ValidationError(
				`Cannot transition from '${existing.status}' to '${data.status}'. Allowed: ${allowed.join(", ")}`,
			);
		}
	}

	return withTransaction(async (client) => {
		const fields: string[] = [];
		const params: unknown[] = [];
		let paramIndex = 1;

		const allowedFields = [
			"title", "description", "status", "priority",
			"assignee_id", "due_date", "tags", "estimated_hours", "actual_hours",
		];

		for (const key of allowedFields) {
			const value = (data as Record<string, unknown>)[key];
			if (value !== undefined) {
				fields.push(`${key} = $${paramIndex}`);
				params.push(value);
				paramIndex++;
			}
		}

		if (fields.length === 0) return existing;

		params.push(id);

		const result = await client.query<Task>(
			`UPDATE tasks SET ${fields.join(", ")}, updated_at = NOW()
			 WHERE id = $${paramIndex} RETURNING *`,
			params,
		);

		const updated = result.rows[0];

		// Notify on assignment change
		if (data.assignee_id && data.assignee_id !== existing.assignee_id) {
			await sendTaskNotification(updated, "assigned");
		}

		// Notify on status change
		if (data.status && data.status !== existing.status) {
			await sendTaskNotification(updated, "status_changed");
		}

		return updated;
	});
}

/** Delete a task. Only allowed for backlog/archived tasks. */
export async function deleteTask(id: EntityId): Promise<void> {
	const task = await getTaskById(id);
	if (!["backlog", "archived"].includes(task.status)) {
		throw new ValidationError("Can only delete tasks in 'backlog' or 'archived' status");
	}
	await query("DELETE FROM tasks WHERE id = $1", [id]);
}

/** Add a comment to a task. */
export async function addComment(
	taskId: EntityId,
	authorId: EntityId,
	body: string,
): Promise<TaskComment> {
	await getTaskById(taskId); // Ensure task exists
	return queryOne<TaskComment>(
		`INSERT INTO task_comments (task_id, author_id, body)
		 VALUES ($1, $2, $3) RETURNING *`,
		[taskId, authorId, body],
	);
}

/** List comments for a task. */
export async function listComments(taskId: EntityId): Promise<TaskComment[]> {
	return query<TaskComment>(
		"SELECT * FROM task_comments WHERE task_id = $1 ORDER BY created_at ASC",
		[taskId],
	);
}

/** Get task counts grouped by status for a team dashboard. */
export async function getTaskStats(teamId: EntityId): Promise<Record<TaskStatus, number>> {
	const rows = await query<{ status: TaskStatus; count: string }>(
		"SELECT status, COUNT(*) as count FROM tasks WHERE team_id = $1 GROUP BY status",
		[teamId],
	);

	const stats: Record<string, number> = {
		backlog: 0, todo: 0, in_progress: 0, review: 0, done: 0, archived: 0,
	};

	for (const row of rows) {
		stats[row.status] = Number.parseInt(row.count, 10);
	}

	return stats as Record<TaskStatus, number>;
}
