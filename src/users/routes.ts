/**
 * User management routes: list, get, update, delete.
 * All endpoints require authentication; some require admin role.
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { requireAuth, requireRole } from "../middleware/authenticate.js";
import { paginationSchema } from "../shared/validators.js";
import { getUserById, listUsers, updateUser, deleteUser } from "./repository.js";

/** Create the users router. */
export function createUsersRouter(): Router {
	const router = Router();

	router.use(requireAuth);

	/** GET /users — list all users (paginated). */
	router.get("/", async (req: Request, res: Response) => {
		const { page, per_page } = paginationSchema.parse(req.query);
		const teamId = req.query.team_id as string | undefined;
		const result = await listUsers(page, per_page, teamId);
		res.json(result);
	});

	/** GET /users/me — get the authenticated user's profile. */
	router.get("/me", async (req: Request, res: Response) => {
		const user = await getUserById(req.user!.sub);
		res.json({ data: user });
	});

	/** GET /users/:id — get a user by ID. */
	router.get("/:id", async (req: Request, res: Response) => {
		const user = await getUserById(req.params.id);
		res.json({ data: user });
	});

	/** PATCH /users/:id — update a user (admin or self). */
	router.patch("/:id", async (req: Request, res: Response) => {
		const targetId = req.params.id;
		const isSelf = req.user!.sub === targetId;
		const isAdmin = req.user!.role === "admin" || req.user!.role === "owner";

		if (!isSelf && !isAdmin) {
			res.status(403).json({ code: "FORBIDDEN", message: "Cannot update other users" });
			return;
		}

		// Non-admins cannot change their own role
		if (!isAdmin && req.body.role) {
			delete req.body.role;
		}

		const user = await updateUser(targetId, req.body);
		res.json({ data: user });
	});

	/** DELETE /users/:id — delete a user (admin only). */
	router.delete("/:id", requireRole("admin", "owner"), async (req: Request, res: Response) => {
		await deleteUser(req.params.id);
		res.status(204).end();
	});

	return router;
}
