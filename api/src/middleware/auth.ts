import type { Request, Response, NextFunction } from "express";
import { sessionOptions } from "../lib/auth.js";
import { getSessionById } from "../db/db_api.js";

export default async function auth(req: Request, res: Response, next: NextFunction) {
    const sessionCookie = req.cookies[sessionOptions.cookieName];
    if (!sessionCookie) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    const session = await getSessionById(sessionCookie);
    if (!session) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    if (session.expiresAt < new Date()) {
        return res.status(401).json({ error: "Session expired" });
    }

    // Attach user info to request object for downstream handlers
    (req as any).user = session.user;
    next();
}
