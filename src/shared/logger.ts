/**
 * Structured logging via Winston.
 * JSON output in production, colorized console in development.
 */

import winston from "winston";

const isDev = process.env.NODE_ENV !== "production";

export const logger = winston.createLogger({
	level: isDev ? "debug" : "info",
	format: winston.format.combine(
		winston.format.timestamp(),
		isDev
			? winston.format.combine(
					winston.format.colorize(),
					winston.format.simple(),
				)
			: winston.format.json(),
	),
	transports: [new winston.transports.Console()],
});
