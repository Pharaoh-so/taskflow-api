/**
 * Notification routes: list, mark read, manage webhooks.
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { requireAuth } from "../middleware/authenticate.js";
import { paginationSchema, createWebhookSchema } from "../shared/validators.js";
import { ValidationError, AuthorizationError } from "../shared/errors.js";
import { query } from "../shared/database.js";
import { markNotificationRead, getUnreadCount } from "./dispatcher.js";
import { createWebhookSubscription, deactivateWebhook } from "./webhooks.js";
import type { Notification } from "../shared/types.js";

/** Create the notifications router. */
export function createNotificationsRouter(): Router {
	const router = Router();

	router.use(requireAuth);

	/** GET /notifications — list user's notifications. */
	router.get("/", async (req: Request, res: Response) => {
		const { page, per_page } = paginationSchema.parse(req.query);
		const offset = (page - 1) * per_page;

		const notifications = await query<Notification>(
			`SELECT * FROM notifications
			 WHERE user_id = $1
			 ORDER BY created_at DESC
			 LIMIT $2 OFFSET $3`,
			[req.user!.sub, per_page, offset],
		);

		const unreadCount = await getUnreadCount(req.user!.sub);

		res.json({
			data: notifications,
			unread_count: unreadCount,
			page,
			per_page,
		});
	});

	/** POST /notifications/:id/read — mark a notification as read. */
	router.post("/:id/read", async (req: Request, res: Response) => {
		await markNotificationRead(req.params.id, req.user!.sub);
		res.status(204).end();
	});

	/** POST /webhooks — create a webhook subscription (requires team). */
	router.post("/webhooks", async (req: Request, res: Response) => {
		if (!req.user!.team_id) {
			throw new AuthorizationError("Must belong to a team to create webhooks");
		}

		const parsed = createWebhookSchema.safeParse(req.body);
		if (!parsed.success) {
			throw new ValidationError("Invalid webhook data");
		}

		const subscription = await createWebhookSubscription(
			req.user!.team_id,
			parsed.data.url,
			parsed.data.events,
		);

		res.status(201).json({ data: subscription });
	});

	/** DELETE /webhooks/:id — deactivate a webhook subscription. */
	router.delete("/webhooks/:id", async (req: Request, res: Response) => {
		await deactivateWebhook(req.params.id);
		res.status(204).end();
	});

	return router;
}
