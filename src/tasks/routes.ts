/**
 * Task management routes: CRUD, status transitions, comments.
 * All endpoints require authentication and team membership.
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { requireAuth } from "../middleware/authenticate.js";
import { AuthorizationError, ValidationError } from "../shared/errors.js";
import type { TaskStatus } from "../shared/types.js";
import {
	createCommentSchema,
	createTaskSchema,
	paginationSchema,
	updateTaskSchema,
} from "../shared/validators.js";
import {
	addComment,
	createTask,
	deleteTask,
	getTaskById,
	getTaskStats,
	listComments,
	listTasks,
	updateTask,
} from "./repository.js";

/** Create the tasks router. */
export function createTasksRouter(): Router {
	const router = Router();

	router.use(requireAuth);

	/** POST /tasks — create a new task. */
	router.post("/", async (req: Request, res: Response) => {
		const parsed = createTaskSchema.safeParse(req.body);
		if (!parsed.success) {
			throw new ValidationError("Invalid task data", {
				issues: parsed.error.issues,
			});
		}

		if (!req.user!.team_id) {
			throw new AuthorizationError("Must belong to a team to create tasks");
		}

		const task = await createTask(
			parsed.data,
			req.user!.sub,
			req.user!.team_id,
		);
		res.status(201).json({ data: task });
	});

	/** GET /tasks — list tasks for the user's team. */
	router.get("/", async (req: Request, res: Response) => {
		if (!req.user!.team_id) {
			throw new AuthorizationError("Must belong to a team to view tasks");
		}

		const { page, per_page } = paginationSchema.parse(req.query);
		const result = await listTasks(req.user!.team_id, {
			status: req.query.status as TaskStatus | undefined,
			assignee_id: req.query.assignee_id as string | undefined,
			priority: req.query.priority as string | undefined,
			page,
			per_page,
		});

		res.json(result);
	});

	/** GET /tasks/stats — get task counts by status for the team. */
	router.get("/stats", async (req: Request, res: Response) => {
		if (!req.user!.team_id) {
			throw new AuthorizationError("Must belong to a team");
		}
		const stats = await getTaskStats(req.user!.team_id);
		res.json({ data: stats });
	});

	/** GET /tasks/:id — get a single task. */
	router.get("/:id", async (req: Request, res: Response) => {
		const task = await getTaskById(req.params.id);
		res.json({ data: task });
	});

	/** PATCH /tasks/:id — update a task. */
	router.patch("/:id", async (req: Request, res: Response) => {
		const parsed = updateTaskSchema.safeParse(req.body);
		if (!parsed.success) {
			throw new ValidationError("Invalid update data", {
				issues: parsed.error.issues,
			});
		}
		const task = await updateTask(req.params.id, parsed.data);
		res.json({ data: task });
	});

	/** DELETE /tasks/:id — delete a task (backlog/archived only). */
	router.delete("/:id", async (req: Request, res: Response) => {
		await deleteTask(req.params.id);
		res.status(204).end();
	});

	/** POST /tasks/:id/comments — add a comment. */
	router.post("/:id/comments", async (req: Request, res: Response) => {
		const parsed = createCommentSchema.safeParse(req.body);
		if (!parsed.success) {
			throw new ValidationError("Invalid comment data");
		}
		const comment = await addComment(
			req.params.id,
			req.user!.sub,
			parsed.data.body,
		);
		res.status(201).json({ data: comment });
	});

	/** GET /tasks/:id/comments — list comments for a task. */
	router.get("/:id/comments", async (req: Request, res: Response) => {
		const comments = await listComments(req.params.id);
		res.json({ data: comments });
	});

	return router;
}
