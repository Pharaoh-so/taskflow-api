/**
 * User data access layer.
 * All database operations for user CRUD and lookups.
 */

import { query, queryMaybe, queryOne } from "../shared/database.js";
import { NotFoundError } from "../shared/errors.js";
import type { EntityId, PaginatedResponse, User } from "../shared/types.js";

/** Create a new user with default 'member' role. */
export async function createUser(data: {
	email: string;
	name: string;
	password_hash: string;
}): Promise<User> {
	return queryOne<User>(
		`INSERT INTO users (email, name, password_hash, role)
		 VALUES ($1, $2, $3, 'member')
		 RETURNING *`,
		[data.email, data.name, data.password_hash],
	);
}

/** Find a user by their email address. */
export async function getUserByEmail(email: string): Promise<User | null> {
	return queryMaybe<User>("SELECT * FROM users WHERE email = $1", [email]);
}

/** Find a user by ID. Throws NotFoundError if not found. */
export async function getUserById(id: EntityId): Promise<User> {
	const user = await queryMaybe<User>("SELECT * FROM users WHERE id = $1", [
		id,
	]);
	if (!user) throw new NotFoundError("User", id);
	return user;
}

/** List users with pagination, optionally filtered by team. */
export async function listUsers(
	page: number,
	perPage: number,
	teamId?: EntityId,
): Promise<PaginatedResponse<User>> {
	const offset = (page - 1) * perPage;
	const whereClause = teamId ? "WHERE team_id = $3" : "";
	const params: unknown[] = [perPage, offset];
	if (teamId) params.push(teamId);

	const [users, countResult] = await Promise.all([
		query<User>(
			`SELECT * FROM users ${whereClause} ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
			params,
		),
		query<{ count: string }>(
			`SELECT COUNT(*) as count FROM users ${whereClause}`,
			teamId ? [teamId] : [],
		),
	]);

	const total = Number.parseInt(countResult[0].count, 10);

	return {
		data: users,
		total,
		page,
		per_page: perPage,
		has_more: offset + perPage < total,
	};
}

/** Update a user's profile fields. */
export async function updateUser(
	id: EntityId,
	data: Partial<Pick<User, "name" | "avatar_url" | "role" | "team_id">>,
): Promise<User> {
	const fields: string[] = [];
	const params: unknown[] = [];
	let paramIndex = 1;

	for (const [key, value] of Object.entries(data)) {
		if (value !== undefined) {
			fields.push(`${key} = $${paramIndex}`);
			params.push(value);
			paramIndex++;
		}
	}

	if (fields.length === 0) return getUserById(id);

	params.push(id);
	return queryOne<User>(
		`UPDATE users SET ${fields.join(", ")}, updated_at = NOW()
		 WHERE id = $${paramIndex} RETURNING *`,
		params,
	);
}

/** Update the last login timestamp. */
export async function updateLastLogin(id: EntityId): Promise<void> {
	await query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [id]);
}

/** Delete a user by ID. */
export async function deleteUser(id: EntityId): Promise<void> {
	const result = await query("DELETE FROM users WHERE id = $1 RETURNING id", [
		id,
	]);
	if (result.length === 0) throw new NotFoundError("User", id);
}
