/**
 * Authentication routes: register, login, refresh, logout.
 * Delegates credential validation to the users module.
 */

import { Router } from "express";
import type { Request, Response } from "express";
import { AuthenticationError, ValidationError } from "../shared/errors.js";
import { logger } from "../shared/logger.js";
import { loginSchema, registerUserSchema } from "../shared/validators.js";
import {
	createUser,
	getUserByEmail,
	updateLastLogin,
} from "../users/repository.js";
import {
	generateAccessToken,
	generateRefreshToken,
	verifyRefreshToken,
} from "./jwt.js";
import { comparePassword, hashPassword } from "./passwords.js";

/** Create the auth router with register/login/refresh endpoints. */
export function createAuthRouter(): Router {
	const router = Router();

	/** POST /auth/register — create a new user account. */
	router.post("/register", async (req: Request, res: Response) => {
		const parsed = registerUserSchema.safeParse(req.body);
		if (!parsed.success) {
			throw new ValidationError("Invalid registration data", {
				issues: parsed.error.issues,
			});
		}

		const { email, password, name } = parsed.data;

		const existing = await getUserByEmail(email);
		if (existing) {
			throw new ValidationError("Email already registered");
		}

		const passwordHash = await hashPassword(password);
		const user = await createUser({ email, name, password_hash: passwordHash });

		const accessToken = generateAccessToken({
			sub: user.id,
			email: user.email,
			role: user.role,
			team_id: user.team_id,
		});
		const refreshToken = generateRefreshToken(user.id);

		logger.info("User registered", { userId: user.id, email });

		res.status(201).json({
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				role: user.role,
			},
			access_token: accessToken,
			refresh_token: refreshToken,
		});
	});

	/** POST /auth/login — authenticate with email and password. */
	router.post("/login", async (req: Request, res: Response) => {
		const parsed = loginSchema.safeParse(req.body);
		if (!parsed.success) {
			throw new ValidationError("Invalid login data");
		}

		const { email, password } = parsed.data;
		const user = await getUserByEmail(email);
		if (!user) {
			throw new AuthenticationError("Invalid email or password");
		}

		const valid = await comparePassword(password, user.password_hash);
		if (!valid) {
			throw new AuthenticationError("Invalid email or password");
		}

		await updateLastLogin(user.id);

		const accessToken = generateAccessToken({
			sub: user.id,
			email: user.email,
			role: user.role,
			team_id: user.team_id,
		});
		const refreshToken = generateRefreshToken(user.id);

		logger.info("User logged in", { userId: user.id });

		res.json({
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
				role: user.role,
			},
			access_token: accessToken,
			refresh_token: refreshToken,
		});
	});

	/** POST /auth/refresh — exchange a refresh token for a new access token. */
	router.post("/refresh", async (req: Request, res: Response) => {
		const { refresh_token } = req.body as { refresh_token?: string };
		if (!refresh_token) {
			throw new AuthenticationError("Refresh token required");
		}

		const userId = verifyRefreshToken(refresh_token);
		if (!userId) {
			throw new AuthenticationError("Invalid or expired refresh token");
		}

		const user = await getUserByEmail(userId);
		if (!user) {
			throw new AuthenticationError("User not found");
		}

		const accessToken = generateAccessToken({
			sub: user.id,
			email: user.email,
			role: user.role,
			team_id: user.team_id,
		});

		res.json({ access_token: accessToken });
	});

	return router;
}
