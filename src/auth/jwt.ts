/**
 * JWT token generation and verification.
 * Issues short-lived access tokens and longer-lived refresh tokens.
 */

import jwt from "jsonwebtoken";
import type { EntityId, UserRole } from "../shared/types.js";

/** Payload encoded in access tokens. */
export interface TokenPayload {
	sub: EntityId;
	email: string;
	role: UserRole;
	team_id: EntityId | null;
}

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

/** Get the JWT signing secret from environment. */
function getSecret(): string {
	const secret = process.env.JWT_SECRET;
	if (!secret) throw new Error("JWT_SECRET environment variable is required");
	return secret;
}

/** Generate an access token for authenticated requests. */
export function generateAccessToken(payload: TokenPayload): string {
	return jwt.sign(payload, getSecret(), {
		expiresIn: ACCESS_TOKEN_EXPIRY,
		issuer: "taskflow-api",
	});
}

/** Generate a refresh token for obtaining new access tokens. */
export function generateRefreshToken(userId: EntityId): string {
	return jwt.sign({ sub: userId, type: "refresh" }, getSecret(), {
		expiresIn: REFRESH_TOKEN_EXPIRY,
		issuer: "taskflow-api",
	});
}

/** Verify and decode an access token. Returns null if invalid. */
export function verifyAccessToken(token: string): TokenPayload | null {
	try {
		const decoded = jwt.verify(token, getSecret(), { issuer: "taskflow-api" });
		return decoded as TokenPayload;
	} catch {
		return null;
	}
}

/** Verify a refresh token. Returns the user ID or null. */
export function verifyRefreshToken(token: string): EntityId | null {
	try {
		const decoded = jwt.verify(token, getSecret(), { issuer: "taskflow-api" }) as {
			sub: EntityId;
			type: string;
		};
		if (decoded.type !== "refresh") return null;
		return decoded.sub;
	} catch {
		return null;
	}
}
