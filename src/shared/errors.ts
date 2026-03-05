/**
 * Application error classes for consistent error handling.
 * Each error type maps to an HTTP status code.
 */

/** Base application error with HTTP status code. */
export class AppError extends Error {
	constructor(
		public readonly code: string,
		message: string,
		public readonly statusCode: number = 500,
		public readonly details?: Record<string, unknown>,
	) {
		super(message);
		this.name = "AppError";
	}
}

/** 404 — requested resource does not exist. */
export class NotFoundError extends AppError {
	constructor(resource: string, id: string) {
		super("NOT_FOUND", `${resource} '${id}' not found`, 404);
	}
}

/** 401 — missing or invalid authentication. */
export class AuthenticationError extends AppError {
	constructor(message = "Authentication required") {
		super("UNAUTHENTICATED", message, 401);
	}
}

/** 403 — authenticated but insufficient permissions. */
export class AuthorizationError extends AppError {
	constructor(message = "Insufficient permissions") {
		super("FORBIDDEN", message, 403);
	}
}

/** 400 — request data failed validation. */
export class ValidationError extends AppError {
	constructor(message: string, details?: Record<string, unknown>) {
		super("VALIDATION_ERROR", message, 400, details);
	}
}

/** 409 — operation conflicts with current state. */
export class ConflictError extends AppError {
	constructor(message: string) {
		super("CONFLICT", message, 409);
	}
}
