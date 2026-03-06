/**
 * Global Express error handler.
 * Converts AppError instances to structured JSON responses.
 */

import type { NextFunction, Request, Response } from "express";
import { AppError } from "../shared/errors.js";
import { logger } from "../shared/logger.js";
import type { ApiError } from "../shared/types.js";

/** Catch-all error handler — must be registered last. */
export function errorHandler(
	err: Error,
	_req: Request,
	res: Response,
	_next: NextFunction,
): void {
	if (err instanceof AppError) {
		const body: ApiError = {
			code: err.code,
			message: err.message,
			...(err.details && { details: err.details }),
		};
		res.status(err.statusCode).json(body);
		return;
	}

	// Unexpected errors — log full stack, return generic message
	logger.error("Unhandled error", { error: err.message, stack: err.stack });
	res.status(500).json({
		code: "INTERNAL_ERROR",
		message: "An unexpected error occurred",
	} satisfies ApiError);
}
