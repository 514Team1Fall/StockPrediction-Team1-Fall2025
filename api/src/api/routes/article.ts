import express, { type Request, type Response } from "express";
import crypto from "crypto";
import {
    bulkCreateNewsArticles, bulkUpsertArticleTickerSentiments,
    createNewsArticle,
    doesNewsArticleIdExist, getAllArticlesWithTickerSentiments, getArticleTickerSentiments,
    getTickerBySymbol,
    upsertArticleTickerSentiment
} from "../../db/db_api.js";
import auth from "../../middleware/auth.js";
import { getDateFromCompact } from "../../util/utils.js";
import { publishMessage } from "../../lib/sns.js";

const articleRouter = express.Router();

articleRouter.get("/", auth, async (req, res) => {
    const articles = await getAllArticlesWithTickerSentiments(undefined);
    return res.json(articles);
})

articleRouter.get("/findSentiments/:tickerSymbol", async (req, res) => {
    const symbol = req.params.tickerSymbol;

    if (symbol === undefined || symbol.trim().length === 0) {
        return res.status(400).json({ error: "Missing or invalid tickerSymbol" });
    }

    const ticker = await getTickerBySymbol(symbol);

    if (ticker === null) {
        return res.status(400).json({ error: "Invalid tickerSymbol; ticker not found" });
    }

    const articles = await getAllArticlesWithTickerSentiments(symbol);
    return res.json(articles);
})

/**
 * Create a new news article
 * Expected body: {
 *  title: string,
 *  url: string,
 *  publishedAt?: string
 *  summary?: string
 * }
 * articleId is sha256(url) hex
 */
articleRouter.post("/", async (req: Request, res: Response) => {
    const { title, url, summary, publishedAt, overallSentimentScore, overallSentimentLabel } = req.body;

    if (typeof url !== "string" || url.trim().length === 0) {
        return res.status(400).json({ error: "Missing or invalid url" });
    }

    if (typeof title !== "string" || title.trim().length === 0) {
        return res.status(400).json({ error: "Missing or invalid title" });
    }

    if (url === undefined || title === undefined || publishedAt === undefined || summary === undefined) {
        return res.status(400).json({ error: "Missing required fields. Must include title, url, summary and publishedAt." });
    }

    const normalizedUrl = url.trim();
    const normalizedTitle = title.trim();

    // Validate and convert publishedAt (if provided) to a Date
    let publishedAtDate: Date | undefined = undefined;
    if (publishedAt !== undefined) {
        if (typeof publishedAt !== "string") {
            return res.status(400).json({ error: "publishedAt must be a string" });
        }

        let parsed = getDateFromCompact(publishedAt);

        if (parsed === null) {
            parsed = new Date(publishedAt);
        }

        if (Number.isNaN(parsed.getTime())) {
            return res.status(400).json({ error: "publishedAt is not a valid date" });
        }
        publishedAtDate = parsed;
    }

    const articleId = crypto.createHash("sha256").update(normalizedUrl).digest("hex");

    const article = await doesNewsArticleIdExist(articleId);

    if (article) {
        return res.status(409).json({ error: "Article with the same URL already exists" });
    }

    const newArticle = {
        articleId: articleId,
        url: normalizedUrl,
        title: normalizedTitle,
        summary: summary,
        publishedAt: publishedAtDate,
        overallSentimentScore: overallSentimentScore === undefined ? undefined : overallSentimentScore,
        overallSentimentLabel: overallSentimentLabel === undefined ? undefined : overallSentimentLabel,
    };

    try {
        const created = await createNewsArticle(newArticle);
        return res.status(201).json(created);
    } catch (error: any) {
        return res.status(500).json({ error: error?.message ?? "Failed to create article" });
    }
});

/**
 * Upsert sentiment for a ticker on an article
 * Path param: articleId
 * Expected body:
 * {
 *  tickerSymbol: str,
 *  tickerSentimentScore?: string|number|null,
 *  tickerSentimentLabel?: string|null,
 *  relevanceScore?: string|number|null
 * }
 */
articleRouter.post("/:articleId/tickers", async (req: Request, res: Response) => {
    const articleId = req.params.articleId;
    const { tickerSymbol, tickerSentimentScore, tickerSentimentLabel, relevanceScore } = req.body;

    if (typeof tickerSymbol !== "string" || tickerSymbol.trim().length === 0) {
        return res.status(400).json({ error: "Missing or invalid tickerSymbol" });
    }

    const ticker = await getTickerBySymbol(tickerSymbol);

    if (ticker === null) {
        return res.status(400).json({ error: "Invalid tickerSymbol; ticker not found" });
    }

    const tickerId = ticker.tickerId;

    if (typeof articleId !== "string" || articleId.length === 0) {
        return res.status(400).json({ error: "Invalid articleId" });
    }

    if (typeof tickerId !== "number" || Number.isNaN(tickerId) || !Number.isInteger(tickerId)) {
        return res.status(400).json({ error: "Invalid tickerId; must be an integer" });
    }

    const params = {
        articleId,
        tickerId,
        tickerSentimentScore:
            tickerSentimentScore === null || tickerSentimentScore === undefined
                ? undefined
                : tickerSentimentScore,
        tickerSentimentLabel:
            tickerSentimentLabel === null || tickerSentimentLabel === undefined
                ? undefined
                : tickerSentimentLabel,
        relevanceScore:
            relevanceScore === null || relevanceScore === undefined ? undefined : relevanceScore,
    };

    try {
        const finalRow = await upsertArticleTickerSentiment(params);

        return res.status(200).json(finalRow);
    } catch (error: any) {
        return res.status(500).json({ error: error?.message ?? "Failed to upsert ticker sentiment" });
    }
});

/**
 * Get sentiments for all tickers on an article
 */
articleRouter.get("/:articleId/tickers", async (req: Request, res: Response) => {
    const articleId = req.params.articleId;

    if (typeof articleId !== "string" || articleId.length === 0) {
        return res.status(400).json({ error: "Invalid articleId" });
    }

    try {
        const article = await doesNewsArticleIdExist(articleId);
        if (!article) {
            return res.status(404).json({ error: "Article not found" });
        }

        const tickersWithSentiment = await getArticleTickerSentiments(articleId);
        return res.json(tickersWithSentiment);
    } catch (error: any) {
        return res.status(500).json({ error: error?.message ?? "Failed to get ticker sentiments for article" });
    }
});

/**
 * Bulk create articles and upsert sentiments
 * Expected body: {
 *   articles: NewNewsArticle[],
 *   sentiments: {
 *     articleId: string;
 *     tickerSymbol: string;
 *     tickerSentimentScore?: string | number | null;
 *     tickerSentimentLabel?: string | null;
 *     relevanceScore?: string | number | null;
 *   }[]
 * }
 */
articleRouter.post("/bulk", async (req: Request, res: Response) => {
    const { articles, sentiments } = req.body;

    if (!Array.isArray(articles) || !Array.isArray(sentiments)) {
        return res.status(400).json({ error: "articles and sentiments must be arrays" });
    }

    if (articles.length === 0 && sentiments.length === 0) {
        return res.status(400).json({ error: "At least one article or sentiment must be provided" });
    }

    // Basic validation and parsing for articles
    const parsedArticles = [];
    for (const article of articles) {
        if (!article.url || !article.title || !article.summary || !article.publishedAt) {
            return res.status(400).json({ error: "Each article must have url, title, summary, and publishedAt" });
        }

        // Parse publishedAt
        let publishedAtDate: Date;
        if (typeof article.publishedAt === "string") {
            let parsed = getDateFromCompact(article.publishedAt);
            if (parsed === null) {
                parsed = new Date(article.publishedAt);
            }
            if (Number.isNaN(parsed.getTime())) {
                return res.status(400).json({ error: "publishedAt is not a valid date" });
            }
            publishedAtDate = parsed;
        } else {
            return res.status(400).json({ error: "publishedAt must be a string" });
        }

        parsedArticles.push({
            ...article,
            publishedAt: publishedAtDate,
        });
    }

    // Basic validation for sentiments
    for (const sentiment of sentiments) {
        if (!sentiment.articleId || !sentiment.tickerSymbol) {
            return res.status(400).json({ error: "Each sentiment must have articleId and tickerSymbol" });
        }
    }

    try {
        if (parsedArticles.length > 0) {
            await bulkCreateNewsArticles(parsedArticles);
        }
        if (sentiments.length > 0) {
            await bulkUpsertArticleTickerSentiments(sentiments);

            for (const sentiment of sentiments) {
                if (sentiment.tickerSentimentScore > 0) {
                    const article = parsedArticles.find(a => a.articleId === sentiment.articleId);
                    if (article === undefined) {
                        continue;
                    }
                    publishMessage(sentiment.tickerSymbol, "Negative sentiment alert", `The article titled "${article.title}" has a negative sentiment score of ${sentiment.tickerSentimentScore} for ticker ${sentiment.tickerSymbol}. URL: ${article.url}`);
                }
            }
        }
        return res.status(201).json({ message: "Bulk operation completed successfully" });
    } catch (error: any) {
        console.log(error);
        return res.status(500).json({ error: error?.message ?? "Failed to perform bulk operation" });
    }
});

/**
 * Get articleId by URL
 * Expected body:
 * {
 *  url: string
 * }
 */
articleRouter.get("/findArticleId", async (req: Request, res: Response) => {
    const url = req.body.url;

    if (typeof url !== "string" || url.trim().length === 0) {
        return res.status(400).json({ error: "Missing or invalid url" });
    }

    const normalizedUrl = url.trim();
    const articleId = crypto.createHash("sha256").update(normalizedUrl).digest("hex");
    return res.json({ articleId });
});

export default articleRouter;
