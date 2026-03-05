/**
 * Password hashing and comparison using bcrypt.
 * Cost factor tuned for reasonable latency on commodity hardware.
 */

import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/** Hash a plaintext password for storage. */
export async function hashPassword(plaintext: string): Promise<string> {
	return bcrypt.hash(plaintext, SALT_ROUNDS);
}

/** Compare a plaintext password against a stored hash. */
export async function comparePassword(plaintext: string, hash: string): Promise<boolean> {
	return bcrypt.compare(plaintext, hash);
}
