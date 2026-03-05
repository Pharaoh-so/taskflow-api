/**
 * Email delivery via SMTP.
 * Uses nodemailer with connection pooling for batch sends.
 */

import nodemailer from "nodemailer";
import { logger } from "../shared/logger.js";

let transporter: nodemailer.Transporter | null = null;

/** Initialize the email transporter from environment config. */
function getTransporter(): nodemailer.Transporter {
	if (transporter) return transporter;

	transporter = nodemailer.createTransport({
		host: process.env.SMTP_HOST ?? "localhost",
		port: Number(process.env.SMTP_PORT ?? 587),
		secure: process.env.SMTP_SECURE === "true",
		auth: process.env.SMTP_USER
			? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
			: undefined,
		pool: true,
		maxConnections: 5,
	});

	return transporter;
}

/** Send a single email. Returns true on success, false on failure. */
export async function sendEmail(
	to: string,
	subject: string,
	body: string,
): Promise<boolean> {
	try {
		const info = await getTransporter().sendMail({
			from: process.env.EMAIL_FROM ?? "noreply@taskflow.local",
			to,
			subject,
			text: body,
			html: `<p>${body.replace(/\n/g, "<br>")}</p>`,
		});

		logger.debug("Email sent", { messageId: info.messageId, to });
		return true;
	} catch (err) {
		logger.error("Email delivery failed", {
			to,
			subject,
			error: err instanceof Error ? err.message : String(err),
		});
		return false;
	}
}

/** Send an email to multiple recipients. */
export async function sendBulkEmail(
	recipients: string[],
	subject: string,
	body: string,
): Promise<{ sent: number; failed: number }> {
	const results = await Promise.allSettled(
		recipients.map((to) => sendEmail(to, subject, body)),
	);

	const sent = results.filter((r) => r.status === "fulfilled" && r.value).length;
	return { sent, failed: recipients.length - sent };
}
