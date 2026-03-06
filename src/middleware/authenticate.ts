/**
 * Express middleware for JWT authentication.
 * Extracts and validates Bearer tokens, attaching user context to requests.
 */

import type { NextFunction, Request, Response } from "express";
import { type TokenPayload, verifyAccessToken } from "../auth/jwt.js";
import { AuthenticationError, AuthorizationError } from "../shared/errors.js";
import type { UserRole } from "../shared/types.js";

/** Extend Express Request with authenticated user info. */
declare global {
	namespace Express {
		interface Request {
			user?: TokenPayload;
		}
	}
}

/** Extract Bearer token from Authorization header. */
function extractToken(req: Request): string | null {
	const header = req.headers.authorization;
	if (!header?.startsWith("Bearer ")) return null;
	return header.slice(7);
}

/** Require a valid JWT on the request. Rejects with 401 if missing/invalid. */
export function requireAuth(
	req: Request,
	_res: Response,
	next: NextFunction,
): void {
	const token = extractToken(req);
	if (!token) {
		throw new AuthenticationError("Bearer token required");
	}

	const payload = verifyAccessToken(token);
	if (!payload) {
		throw new AuthenticationError("Invalid or expired token");
	}

	req.user = payload;
	next();
}

/** Require the authenticated user to have one of the specified roles. */
export function requireRole(...roles: UserRole[]) {
	return (req: Request, _res: Response, next: NextFunction): void => {
		if (!req.user) {
			throw new AuthenticationError();
		}
		if (!roles.includes(req.user.role)) {
			throw new AuthorizationError(`Requires one of: ${roles.join(", ")}`);
		}
		next();
	};
}
