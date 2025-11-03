import express, { type Request, type Response } from "express";
import { createTicker, getAllTickers, getTickerBySymbol, getTickersByType, deleteTicker } from "../../db/db_api.js";
import auth from "../../middleware/auth.js";

const tickerRouter = express.Router();

/**
 * Create a new ticker
 */
tickerRouter.post("/", auth, async (req: Request, res: Response) => {
    const { symbol, type } = req.body;

    if (typeof symbol !== "string" || typeof type !== "string") {
        return res.status(400).json({ error: "Invalid input data" });
    }

    if (type !== "stock" && type !== "crypto") {
        return res.status(400).json({ error: "Invalid ticker type" });
    }

    const ticker = await getTickerBySymbol(symbol);
    if (ticker) {
        return res.status(409).json({error: "Ticker already exists"});
    }

    try {
        const newTicker = await createTicker({ symbol, type });
        return res.status(201).json(newTicker);
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

/**
 * Get tickers by type (supports getting all tickers if not given type)
 */
tickerRouter.get("/byType/:type", async (req: Request, res: Response) => {
    const type = req.params.type;

    if (type === "all") {
        try {
            const tickers = await getAllTickers();
            return res.json(tickers);
        } catch (error: any) {
            return res.status(500).json({ error: error.message });
        }
    }

    if (type !== "stock" && type !== "crypto") {
        return res.status(400).json({ error: "Invalid ticker type" });
    }

    try {
        const tickers = await getTickersByType(type);
        return res.json(tickers);
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

/**
 * Get information on a ticker by symbol
 */
tickerRouter.get("/:symbol", async (req: Request, res: Response) => {
    const symbol = req.params.symbol;

    if (typeof symbol !== "string") {
        return res.status(400).json({ error: "Invalid symbol" });
    }

    try {
        const ticker = await getTickerBySymbol(symbol);
        if (!ticker) {
            return res.status(404).json({ error: "Ticker not found" });
        }
        return res.json(ticker);
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

tickerRouter.delete("/:symbol", async (req: Request, res: Response) => {
    const symbol = req.params.symbol;

    if (typeof symbol !== "string") {
        return res.status(400).json({ error: "Invalid symbol" });
    }

    const exists = await getTickerBySymbol(symbol);

    if (!exists) {
        return res.status(404).json({error: "Ticker not found"});
    }

    try {
        const deleted = await deleteTicker(symbol);
        if (deleted) {
            return res.json({ message: "Ticker deleted" });
        }
        return res.status(404).json({ error: "Ticker not found" });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
})

export default tickerRouter;
