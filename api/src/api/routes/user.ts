import express, { type Request, type Response } from "express";
import {
    createTicker,
    addUserWatchlist,
    removeUserWatchlist,
    getUserById,
    getUserWatchlistTickers,
    setUserNotifications, createUser, getTickerBySymbol, getTickersByType,
} from "../../db/db_api.js";
import type { NewTicker, NewUser } from "../../db/schema.js";
import auth from "../../middleware/auth.js";

const userRouter = express.Router();

/**
 * Toggle global notifications for a user
 * body: { enabled: boolean }
 */
userRouter.patch("/notifications", auth, async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const { enabled } = req.body;

    if (typeof userId !== "string" || userId.trim() === "") {
        return res.status(400).json({ error: "Invalid userId" });
    }
    if (typeof enabled !== "boolean") {
        return res.status(400).json({ error: "enabled must be boolean" });
    }

    try {
        const user = await getUserById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const ok = await (async () => {
            return await setUserNotifications(userId, enabled);
        })();

        return res.json({ success: !!ok });
    } catch (error: any) {
        return res.status(500).json({ error: error?.message ?? "Failed to set notifications" });
    }
});

/**
 * Add ticker to user's watchlist (create ticker if missing)
 * body: { symbol: string, type?: "stock" | "crypto", notificationEnabled?: boolean }
 */
userRouter.post("/watchlist", auth, async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const { symbol, type, notificationEnabled } = req.body;

    if (typeof userId !== "string" || userId.trim() === "") {
        return res.status(400).json({ error: "Invalid userId" });
    }
    if (typeof symbol !== "string" || symbol.trim() === "") {
        return res.status(400).json({ error: "Invalid symbol" });
    }
    const normalizedSymbol = symbol.trim();

    try {
        const user = await getUserById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        let ticker = await getTickerBySymbol(normalizedSymbol);
        let tickerId = ticker ? ticker.tickerId : null;
        if (ticker === null) {
            // need type to create ticker
            if (type !== "stock" && type !== "crypto") {
                return res.status(400).json({ error: "Ticker not found; provide type as 'stock' or 'crypto' to create it" });
            }
            const newTicker: NewTicker = { symbol: normalizedSymbol, type };
            const created = await createTicker(newTicker);
            tickerId = created.tickerId;
        }

        const toInsert = {
            userId: userId,
            tickerId: tickerId as number,
            notificationEnabled: typeof notificationEnabled === "boolean" ? notificationEnabled : true,
        };

        try {
            const row = await addUserWatchlist(toInsert);
            return res.status(201).json(row);
        } catch (err: any) {
            // likely unique constraint (already in watchlist)
            if (err?.message && /unique|duplicate/i.test(err.message)) {
                return res.status(409).json({ error: "Ticker already in watchlist" });
            }
            throw err;
        }
    } catch (error: any) {
        return res.status(500).json({ error: error?.message ?? "Failed to add to watchlist" });
    }
});

/**
 * Set per-ticker watchlist notifications
 * Creates ticker/watchlist entry if missing
 * body: {
 *  enabled: boolean,
 *  type?: "stock" | "crypto"  // required if ticker needs to be created
 * }
 */
userRouter.patch("/watchlist/:symbol/notifications", auth, async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    const symbol = req.params.symbol;
    const { enabled, type } = req.body;

    if (typeof userId !== "string" || userId.trim() === "") {
        return res.status(400).json({ error: "Invalid userId" });
    }
    if (typeof symbol !== "string" || symbol.trim() === "") {
        return res.status(400).json({ error: "Invalid symbol" });
    }
    if (typeof enabled !== "boolean") {
        return res.status(400).json({ error: "enabled must be boolean" });
    }

    const normalizedSymbol = symbol.trim();

    try {
        const user = await getUserById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        let ticker = await getTickerBySymbol(normalizedSymbol);
        let tickerId = ticker ? ticker.tickerId : null;
        if (tickerId === null) {
            if (type !== "stock" && type !== "crypto") {
                return res.status(400).json({ error: "Ticker not found; provide type as 'stock' or 'crypto' to create it" });
            }
            const created = await createTicker({ symbol: normalizedSymbol, type });
            tickerId = created.tickerId;
        }

        // remove any existing watchlist entry then re-add with requested enabled flag
        try {
            await removeUserWatchlist(userId, tickerId);
        } catch {
            // ignore remove errors and proceed to add
        }

        try {
            const row = await addUserWatchlist({ userId, tickerId, notificationEnabled: enabled });
            return res.json(row);
        } catch (err: any) {
            // if add failed due to unique constraint (unlikely after remove), return conflict
            if (err?.message && /unique|duplicate/i.test(err.message)) {
                return res.status(409).json({ error: "Watchlist entry already exists" });
            }
            throw err;
        }
    } catch (error: any) {
        return res.status(500).json({ error: error?.message ?? "Failed to set watchlist notification" });
    }
});

/**
 * Remove ticker from user's watchlist
 */
userRouter.delete("/watchlist/:symbol", auth, async (req: Request, res: Response) => {
    const userId = req.params.userId;
    let symbol = req.params.symbol;

    if (typeof userId !== "string" || userId.trim() === "") {
        return res.status(400).json({ error: "Invalid userId" });
    }
    if (typeof symbol !== "string" || symbol.trim() === "") {
        return res.status(400).json({ error: "Invalid symbol" });
    }

    symbol = symbol.trim();

    try {
        const user = await getUserById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const ticker = await getTickerBySymbol(symbol);
        const tickerId = ticker ? ticker.tickerId : null;
        if (tickerId === null) {
            return res.status(404).json({ error: "Ticker not found" });
        }

        const removed = await removeUserWatchlist(userId, tickerId);
        if (removed) {
            return res.json({ success: true });
        }
        return res.status(404).json({ error: "Watchlist entry not found" });
    } catch (error: any) {
        return res.status(500).json({ error: error?.message ?? "Failed to remove watchlist entry" });
    }
});

/**
 * Get all tickers in a user's watchlist
 */
userRouter.get("/watchlist", auth, async (req: Request, res: Response) => {
    const userId = req.user?.userId;

    if (typeof userId !== "string" || userId.trim() === "") {
        return res.status(400).json({ error: "Invalid userId" });
    }

    try {
        const user = await getUserById(userId);
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const tickers = await getUserWatchlistTickers(userId);
        return res.json(tickers);
    } catch (error: any) {
        return res.status(500).json({ error: error?.message ?? "Failed to get watchlist" });
    }
});

export default userRouter;
