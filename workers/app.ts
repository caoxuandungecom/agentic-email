// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { routeAgentRequest } from "agents";
import { Hono } from "hono";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { createRequestHandler } from "react-router";
import { app as apiApp, receiveEmail } from "./index";
import { EmailMCP } from "./mcp";
import type { Env } from "./types";

export { MailboxDO } from "./durableObject";
export { EmailAgent } from "./agent";
export { EmailMCP } from "./mcp";

declare module "react-router" {
	export interface AppLoadContext {
		cloudflare: {
			env: Env;
			ctx: ExecutionContext;
		};
	}
}

const requestHandler = createRequestHandler(
	() => import("virtual:react-router/server-build"),
	import.meta.env.MODE,
);

function getAccessUrls(teamDomain: string) {
	const certsPath = "/cdn-cgi/access/certs";
	const teamUrl = new URL(teamDomain);
	const issuer = teamUrl.origin;
	const certsUrl = teamUrl.pathname.endsWith(certsPath)
		? teamUrl
		: new URL(certsPath, issuer);

	return { issuer, certsUrl };
}

// Main app that wraps the API and adds React Router fallback
const app = new Hono<{ Bindings: Env }>();

import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { SignJWT } from "jose";

// Cloudflare Access JWT validation middleware (production only)
app.use("*", async (c, next) => {
	// Skip validation in development if desired, but we want local auth to work
	// so we will enforce it everywhere except public routes.
	const url = new URL(c.req.url);
	const pathname = url.pathname;

	// Allow public routes and Vite HMR
	const publicPaths = ["/login", "/api/auth/login", "/api/auth/logout", "/@vite", "/__vite", "/@fs", "/@id"];
	if (
		c.req.header("upgrade") === "websocket" ||
		publicPaths.some((p) => pathname.startsWith(p)) ||
		pathname.match(/\.(js|css|svg|ico|png|jpg|woff2?|tsx?)$/)
	) {
		return next();
	}

	const cookie = getCookie(c, "session");
	if (!cookie) {
		return c.redirect("/login");
	}

	try {
		const secret = new TextEncoder().encode(c.env.JWT_SECRET || "default-secret");
		await jwtVerify(cookie, secret);
	} catch {
		return c.redirect("/login");
	}

	return next();
});

// Authentication endpoints
app.post("/api/auth/login", async (c) => {
	const { password } = await c.req.json();
	const expectedPassword = c.env.APP_PASSWORD;

	if (!expectedPassword) {
		return c.json({ error: "Lỗi máy chủ: Chưa cấu hình biến APP_PASSWORD trên Cloudflare" }, 500);
	}

	if (password !== expectedPassword) {
		return c.json({ error: "Mật khẩu không chính xác" }, 401);
	}

	const secret = new TextEncoder().encode(c.env.JWT_SECRET || "default-secret");
	const token = await new SignJWT({ role: "admin" })
		.setProtectedHeader({ alg: "HS256" })
		.setExpirationTime("30d")
		.sign(secret);

	setCookie(c, "session", token, {
		httpOnly: true,
		secure: !import.meta.env.DEV,
		sameSite: "Lax",
		path: "/",
		maxAge: 60 * 60 * 24 * 30, // 30 days
	});

	return c.json({ ok: true });
});

app.post("/api/auth/logout", async (c) => {
	deleteCookie(c, "session", { path: "/" });
	return c.json({ ok: true });
});

// MCP server endpoint — used by AI coding tools (ProtoAgent, Claude Code, Cursor, etc.)
// Must be before API routes and React Router catch-all
const mcpHandler = EmailMCP.serve("/mcp", { binding: "EMAIL_MCP" });
app.all("/mcp", async (c) => {
	return mcpHandler.fetch(c.req.raw, c.env, c.executionCtx as ExecutionContext);
});
app.all("/mcp/*", async (c) => {
	return mcpHandler.fetch(c.req.raw, c.env, c.executionCtx as ExecutionContext);
});

// Mount the API routes
app.route("/", apiApp);

// Agent WebSocket routing - must be before React Router catch-all
app.all("/agents/*", async (c) => {
	const response = await routeAgentRequest(c.req.raw, c.env);
	if (response) return response;
	return c.text("Agent not found", 404);
});

// React Router catch-all: serves the SPA for all non-API routes
app.all("*", (c) => {
	return requestHandler(c.req.raw, {
		cloudflare: { env: c.env, ctx: c.executionCtx as ExecutionContext },
	});
});

// Export the Hono app as the default export with an email handler
export default {
	fetch: app.fetch,
	async email(
		event: { raw: ReadableStream; rawSize: number },
		env: Env,
		ctx: ExecutionContext,
	) {
		try {
			await receiveEmail(event, env, ctx);
		} catch (e) {
			console.error("Failed to process incoming email:", (e as Error).message, (e as Error).stack);
			// Re-throw so Cloudflare's email routing can retry delivery or bounce the message.
			// Swallowing the error would silently drop the email.
			throw e;
		}
	},
};
