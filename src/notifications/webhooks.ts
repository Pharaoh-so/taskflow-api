/**
 * Webhook delivery for external integrations.
 * Teams can subscribe to task events and receive HTTP callbacks.
 */

import crypto from "node:crypto";
import { query } from "../shared/database.js";
import { logger } from "../shared/logger.js";
import type { EntityId, WebhookSubscription } from "../shared/types.js";

/** Sign a webhook payload with HMAC-SHA256. */
function signPayload(payload: string, secret: string): string {
	return crypto.createHmac("sha256", secret).update(payload).digest("hex");
}

/** Deliver a webhook event to all active subscriptions for a team. */
export async function deliverWebhook(
	teamId: EntityId,
	event: string,
	data: Record<string, unknown>,
): Promise<void> {
	const subscriptions = await query<WebhookSubscription>(
		"SELECT * FROM webhook_subscriptions WHERE team_id = $1 AND active = true",
		[teamId],
	);

	const matching = subscriptions.filter((sub) => sub.events.includes(event));
	if (matching.length === 0) return;

	const payload = JSON.stringify({
		event,
		timestamp: new Date().toISOString(),
		data,
	});

	const deliveryPromises = matching.map(async (sub) => {
		const signature = signPayload(payload, sub.secret);

		try {
			const response = await fetch(sub.url, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"X-Webhook-Signature": signature,
					"X-Webhook-Event": event,
				},
				body: payload,
				signal: AbortSignal.timeout(10_000),
			});

			if (!response.ok) {
				logger.warn("Webhook delivery failed", {
					subscriptionId: sub.id,
					url: sub.url,
					status: response.status,
				});
			}
		} catch (err) {
			logger.error("Webhook delivery error", {
				subscriptionId: sub.id,
				url: sub.url,
				error: err instanceof Error ? err.message : String(err),
			});
		}
	});

	await Promise.allSettled(deliveryPromises);
}

/** Create a new webhook subscription. */
export async function createWebhookSubscription(
	teamId: EntityId,
	url: string,
	events: string[],
): Promise<WebhookSubscription> {
	const secret = crypto.randomBytes(32).toString("hex");

	const rows = await query<WebhookSubscription>(
		`INSERT INTO webhook_subscriptions (team_id, url, secret, events, active)
		 VALUES ($1, $2, $3, $4, true) RETURNING *`,
		[teamId, url, secret, events],
	);

	return rows[0];
}

/** Deactivate a webhook subscription. */
export async function deactivateWebhook(id: EntityId): Promise<void> {
	await query(
		"UPDATE webhook_subscriptions SET active = false, updated_at = NOW() WHERE id = $1",
		[id],
	);
}
