/**
 * Application entry point.
 * Assembles Express app from module routers, initializes database, starts server.
 */

import express from "express";
import { initDatabase, closeDatabase } from "./shared/database.js";
import { logger } from "./shared/logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import { createAuthRouter } from "./auth/routes.js";
import { createUsersRouter } from "./users/routes.js";
import { createTasksRouter } from "./tasks/routes.js";
import { createNotificationsRouter } from "./notifications/routes.js";

const PORT = Number(process.env.PORT ?? 3000);
const DATABASE_URL = process.env.DATABASE_URL ?? "postgresql://localhost:5432/taskflow";

/** Create and configure the Express application. */
function createApp(): express.Application {
	const app = express();

	// Global middleware
	app.use(express.json({ limit: "1mb" }));
	app.use((req, _res, next) => {
		logger.debug(`${req.method} ${req.path}`);
		next();
	});

	// Health check
	app.get("/health", (_req, res) => {
		res.json({ status: "ok", timestamp: new Date().toISOString() });
	});

	// Mount module routers
	app.use("/auth", createAuthRouter());
	app.use("/users", createUsersRouter());
	app.use("/tasks", createTasksRouter());
	app.use("/notifications", createNotificationsRouter());

	// Error handler (must be last)
	app.use(errorHandler);

	return app;
}

/** Start the server. */
async function main(): Promise<void> {
	initDatabase(DATABASE_URL);
	const app = createApp();

	const server = app.listen(PORT, () => {
		logger.info(`TaskFlow API running on port ${PORT}`);
	});

	// Graceful shutdown
	const shutdown = async (signal: string) => {
		logger.info(`${signal} received — shutting down`);
		server.close();
		await closeDatabase();
		process.exit(0);
	};

	process.on("SIGTERM", () => shutdown("SIGTERM"));
	process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
	logger.error("Failed to start server", { error: err });
	process.exit(1);
});
