import { db } from "./client.js";
import {eq, and, sql, inArray} from "drizzle-orm";
import crypto from "crypto";
import {
    users,
    tickers,
    userWatchlist,
    newsArticles,
    newsArticleTickers,
    type User,
    type NewUser,
    type Ticker,
    type NewTicker,
    type UserWatchlist,
    type NewUserWatchlist,
    type NewsArticle,
    type NewNewsArticle,
    type NewsArticleTicker,
    type NewNewsArticleTicker,
    sessions,
} from "./schema.js";
import {getDateFromCompact} from "../util/utils.js";
import article from "../api/routes/article.js";

/**
 * Create a user.
 * - Inserts the new user row.
 * - Reads it back to return the full typed row (ensures DB defaults are present).
 */
export async function createUser(newUser: NewUser): Promise<User> {
    await db.insert(users).values(newUser);

    const rows = await db
        .select()
        .from(users)
        .where(eq(users.userId, newUser.userId));

    if (rows.length === 0) {
        throw new Error("Failed to create user");
    }

    return rows[0] as User;
}

/**
 * Get a user by id.
 */
export async function getUserById(userId: string): Promise<User | null> {
    const rows = await db
        .select()
        .from(users)
        .where(eq(users.userId, userId));

    return rows[0] ?? null;
}

/**
 * Get a user by id.
 */
export async function getUserByEmail(email: string): Promise<User | null> {
    const rows = await db
        .select()
        .from(users)
        .where(eq(users.email, email));

    return rows[0] ?? null;
}

/**
 * Get a user by session token.
 */
export async function getSessionById(sessionId: string): Promise<{ sessionId: string; userId: string; expiresAt: Date, user: User } | null> {
    const rows = await db
        .select({
            sessionId: sessions.sessionId,
            userId: sessions.userId,
            expiresAt: sessions.expiresAt,
            user: users,
        })
        .from(sessions)
        .innerJoin(
            users,
            eq(sessions.userId, users.userId)
        )
        .where(eq(sessions.sessionId, sessionId));

    if (rows.length === 0) {
        return null;
    }

    return rows[0] as { sessionId: string; userId: string; expiresAt: Date, user: User };
}


export async function createSession(sessionId: string, userId: string, expiresAt: Date): Promise<void> {
    await db.insert(sessions).values({
        sessionId,
        userId,
        expiresAt,
    });
}

export async function deleteSession(sessionId: string): Promise<void> {
    await db.delete(sessions).where(eq(sessions.sessionId, sessionId));
}

/**
 * Enable or disable user notifications.
 */
export async function setUserNotifications(userId: string, enabled: boolean): Promise<boolean> {
    const result = await db
        .update(users)
        .set({ notificationEnabled: enabled })
        .where(eq(users.userId, userId));

    if (result) {
        return true;
    }

    return false;
}

/**
 * Create a ticker (symbol + type). Returns the created record.
 */
export async function createTicker(newTicker: NewTicker): Promise<Ticker> {
    // Changed to be more robust against concurrent inserts for the same symbol+type
    // this should not happen often, but can occur during pre-seeding or bulk operations
    const existing = await db
        .select()
        .from(tickers)
        .where(and(eq(tickers.symbol, newTicker.symbol), eq(tickers.type, newTicker.type)))
        .limit(1);

    if (existing.length > 0) {
        return existing[0] as Ticker;
    }

    // Try to insert, if a concurrent insert causes an error, fetch the record again
    try {
        await db.insert(tickers).values(newTicker);
    } catch (err) {
        const rows = await db
            .select()
            .from(tickers)
            .where(and(eq(tickers.symbol, newTicker.symbol), eq(tickers.type, newTicker.type)))
            .limit(1);

        if (rows.length > 0) {
            return rows[0] as Ticker;
        }

        throw err;
    }

    const rows = await db
        .select()
        .from(tickers)
        .where(and(eq(tickers.symbol, newTicker.symbol), eq(tickers.type, newTicker.type)));

    if (rows.length === 0) {
        throw new Error("Failed to create ticker");
    }

    return rows[0] as Ticker;
}

/**
 * Get all Tickers
 */
export async function getAllTickers(): Promise<Ticker[]> {
    const rows = await db
        .select()
        .from(tickers);

    return rows as Ticker[];
}

/**
 * Get all tickers of a given type
 * @param type The ticker type ("stock" or "crypto")
 */
export async function getTickersByType(type: "stock" | "crypto"): Promise<Ticker[]> {
    const rows = await db
        .select()
        .from(tickers)
        .where(eq(tickers.type, type));

    return rows as Ticker[];
}

/**
 * Delete a ticker by symbol. Returns true if a row was deleted.
 * @param symbol The ticker symbol (i.e. AAPL or BTC)
 */
export async function deleteTicker(symbol: string): Promise<boolean> {
    const result = await db
        .delete(tickers)
        .where(and(eq(tickers.symbol, symbol)));

    if (result) {
        return true;
    }

    return false;
}

/**
 * Get all tickers in a user's watchlist
 * @param userId The user ID
 */
export async function getUserWatchlistTickers(userId: string): Promise<Ticker[]> {
    const rows = await db
        .select({
            tickerId: tickers.tickerId,
            symbol: tickers.symbol,
            type: tickers.type,
            createdAt: tickers.createdAt,
        })
        .from(tickers)
        .innerJoin(
            userWatchlist,
            eq(tickers.tickerId, userWatchlist.tickerId)
        )
        .where(eq(userWatchlist.userId, userId));

    return rows as Ticker[];
}

/**
 * Get ticker ID by symbol
 * @param symbol The ticker symbol (i.e. AAPL or BTC)
 */
export async function getTickerBySymbol(symbol: string): Promise<Ticker | null> {
    const rows = await db
        .select()
        .from(tickers)
        .where(and(eq(tickers.symbol, symbol)));

    if (rows.length === 0) {
        return null;
    }
    return rows[0] as Ticker;
}

/**
 * Add an item to a user's watchlist.
 * Returns the inserted watchlist row (reads back to include DB defaults).
 * @param entry The watchlist entry to add
 * entry is expected to be { userId: string; tickerId: number; notificationEnabled?: boolean }
 */
export async function addUserWatchlist(entry: NewUserWatchlist): Promise<UserWatchlist> {
    await db.insert(userWatchlist).values(entry);

    const rows = await db
        .select()
        .from(userWatchlist)
        .where(and(eq(userWatchlist.userId, entry.userId), eq(userWatchlist.tickerId, entry.tickerId)));

    if (rows.length === 0) {
        throw new Error("Failed to add watchlist entry");
    }

    return rows[0] as UserWatchlist;
}

/**
 * Remove a watchlist entry. Returns true when a row was deleted.
 * @param userId The user ID (sub attribute from Cognito)
 * @param tickerId The ticker ID
 */
export async function removeUserWatchlist(userId: string, tickerId: number): Promise<boolean> {
    const result = await db
        .delete(userWatchlist)
        .where(and(eq(userWatchlist.userId, userId), eq(userWatchlist.tickerId, tickerId)));

    if (result) {
        return true;
    }

    return false;
}

/**
 * Create a news article. Returns the row back.
 */
export async function createNewsArticle(article: NewNewsArticle): Promise<NewsArticle> {
    await db.insert(newsArticles).values(article);

    const rows = await db
        .select()
        .from(newsArticles)
        .where(eq(newsArticles.articleId, article.articleId));

    if (rows.length === 0) {
        throw new Error("Failed to create news article");
    }

    return rows[0] as NewsArticle;
}

export async function doesNewsArticleIdExist(articleId: string): Promise<boolean> {
    const rows = await db
        .select()
        .from(newsArticles)
        .where(eq(newsArticles.articleId, articleId));

    return rows.length > 0;
}

/**
 * Upsert (insert-or-update) a record in news_article_tickers.
 * - If a row exists for the (articleId, tickerId) composite key, it updates the sentiment fields.
 * - Otherwise inserts a new row.
 * @param params The parameters for upsert
 * - articleId The article ID (sha256 of url)
 * - tickerId The ticker ID
 * - tickerSentimentScore Optional sentiment score (-1.0 to 1.0)
 * - tickerSentimentLabel Optional sentiment label (e.g. "positive", "negative", "neutral")
 * - relevanceScore Optional relevance score (0.0 to 1.0)
 * Returns the final row.
 */
export async function upsertArticleTickerSentiment(params: {
    articleId: string;
    tickerId: number;
    tickerSentimentScore?: string | number | null;
    tickerSentimentLabel?: string | null;
    relevanceScore?: string | number | null;
}): Promise<NewsArticleTicker> {
    const articleId = params.articleId;
    const tickerId = params.tickerId;

    // Check existing row
    const existingRows = await db
        .select()
        .from(newsArticleTickers)
        .where(and(eq(newsArticleTickers.articleId, articleId), eq(newsArticleTickers.tickerId, tickerId)));

    if (existingRows.length === 0) {
        // Insert new
        const toInsert: NewNewsArticleTicker = {
            articleId: articleId,
            tickerId: tickerId,
            tickerSentimentScore: params.tickerSentimentScore as any,
            tickerSentimentLabel: params.tickerSentimentLabel as any,
            relevanceScore: params.relevanceScore as any,
        };

        await db.insert(newsArticleTickers).values(toInsert);
    } else {
        // Update existing
        const updateValues: Partial<NewsArticleTicker> = {};

        if (params.tickerSentimentScore !== undefined) {
            updateValues.tickerSentimentScore = params.tickerSentimentScore as any;
        }

        if (params.tickerSentimentLabel !== undefined) {
            updateValues.tickerSentimentLabel = params.tickerSentimentLabel as any;
        }

        if (params.relevanceScore !== undefined) {
            updateValues.relevanceScore = params.relevanceScore as any;
        }

        const keys = Object.keys(updateValues);
        if (keys.length > 0) {
            await db
                .update(newsArticleTickers)
                .set(updateValues)
                .where(and(eq(newsArticleTickers.articleId, articleId), eq(newsArticleTickers.tickerId, tickerId)));
        }
    }

    // Read back and return final row
    const finalRows = await db
        .select()
        .from(newsArticleTickers)
        .where(and(eq(newsArticleTickers.articleId, articleId), eq(newsArticleTickers.tickerId, tickerId)));

    if (finalRows.length === 0) {
        throw new Error("Failed to upsert article ticker sentiment");
    }

    return finalRows[0] as NewsArticleTicker;
}

/**
 * Get sentiments for all tickers on an article
 * @param articleId sha256 digest fo url
 */
export async function getArticleTickerSentiments(articleId: string): Promise<(NewsArticleTicker & { symbol: string })[]> {
    const rows = await db
        .select({
            articleId: newsArticleTickers.articleId,
            tickerId: newsArticleTickers.tickerId,
            tickerSentimentScore: newsArticleTickers.tickerSentimentScore,
            tickerSentimentLabel: newsArticleTickers.tickerSentimentLabel,
            relevanceScore: newsArticleTickers.relevanceScore,
            symbol: tickers.symbol,
        })
        .from(newsArticleTickers)
        .innerJoin(tickers, eq(newsArticleTickers.tickerId, tickers.tickerId))
        .where(eq(newsArticleTickers.articleId, articleId));

    return rows as (NewsArticleTicker & { symbol: string })[];
}

/**
 * Get all articles along with their associated ticker sentiments
 * @param tickerSymbol Optional ticker symbol to filter articles by
 */
export async function getAllArticlesWithTickerSentiments(tickerSymbol?: string | null): Promise<any[]> {
    let articlesRaw: any[];

    if (tickerSymbol) {
        const ticker = await getTickerBySymbol(tickerSymbol);

        if (ticker === null) {
            console.log(`returns empty array before anything.... getalarticleswihttickersentiments`)
            return [];
        }

        const tickerId = ticker.tickerId;

        // join to filter articles that have this ticker
        const rows = await db
            .select({
                articleId: newsArticles.articleId,
                url: newsArticles.url,
                title: newsArticles.title,
                summary: newsArticles.summary,
                publishedAt: newsArticles.publishedAt,
            })
            .from(newsArticles)
            .innerJoin(newsArticleTickers, eq(newsArticles.articleId, newsArticleTickers.articleId))
            .where(eq(newsArticleTickers.tickerId, tickerId))
            .orderBy(newsArticles.publishedAt);

        // dedupe articles (join may produce duplicates)
        const map: Record<string, any> = {};
        for (const r of rows) {
            map[r.articleId] = r;
        }
        articlesRaw = Object.values(map);
    } else {
        // no filter: return all articles
        articlesRaw = await db
            .select({
                articleId: newsArticles.articleId,
                url: newsArticles.url,
                title: newsArticles.title,
                summary: newsArticles.summary,
                publishedAt: newsArticles.publishedAt,
            })
            .from(newsArticles)
            .orderBy(newsArticles.publishedAt);
    }

    // for each article, fetch all related ticker sentiments (includes symbol as well as id)
    const results = await Promise.all(
        articlesRaw.map(async (a: any) => {
            const tickers = await getArticleTickerSentiments(a.articleId);
            return {
                ...a,
                tickers,
            };
        })
    );

    return results;
}

export function getArticleId(url: string): string {
    const hash = crypto.createHash("sha256");
    hash.update(url);
    return hash.digest("hex");
}


/**
 * Bulk create tickers. Handles duplicates by upserting (no-op update if exists).
 * @param tickerData Array of NewTicker objects to insert { symbol: string; type: "stock" | "crypto"  }
 */
export async function bulkCreateTickers(tickerData: NewTicker[]): Promise<void> {
    if (tickerData.length === 0) return;

    await db.transaction(async (tx) => {
        await tx.insert(tickers).values(tickerData).onDuplicateKeyUpdate({
            set: { tickerId: sql`${tickers.tickerId}` },  // No-op update to skip duplicates
        });
    });
}

/**
 * Bulk create news articles. Handles duplicates by upserting (no-op update if exists).
 * @param articles Array of NewNewsArticle
 */
export async function bulkCreateNewsArticles(articles: NewNewsArticle[]): Promise<void> {
    if (articles.length === 0) return;

    await db.transaction(async (tx) => {
        await tx.insert(newsArticles).values(articles).onDuplicateKeyUpdate({
            set: { articleId: sql`${newsArticles.articleId}` }, // No-op update to skip duplicates
        });
    });
}



/**
 * Bulk upsert article ticker sentiments. Handles duplicates by updating existing rows.
 * If tickerSymbol does not exist, inserts it with type "stock".
 * @param sentiments Array of sentiment objects with tickerSymbol instead of tickerId
 */
export async function bulkUpsertArticleTickerSentiments(sentiments: {
    articleId: string;
    tickerSymbol: string;
    tickerSentimentScore?: string | number | null;
    tickerSentimentLabel?: string | null;
    relevanceScore?: string | number | null;
}[]): Promise<void> {
    if (sentiments.length === 0) return;

    const uniqueSymbols = [...new Set(sentiments.map(s => s.tickerSymbol))];

    await db.transaction(async (tx) => {
        await tx.insert(tickers).values(
            uniqueSymbols.map(symbol => ({ symbol, type: "stock" as const }))
        ).onDuplicateKeyUpdate({
            set: { tickerId: sql`${tickers.tickerId}` },
        });

        // Query tickerIds for the symbols
        const tickerRows = await tx.select({ symbol: tickers.symbol, tickerId: tickers.tickerId })
            .from(tickers)
            .where(and(inArray(tickers.symbol, uniqueSymbols), eq(tickers.type, "stock")));

        const symbolToId = new Map(tickerRows.map(row => [row.symbol, row.tickerId]));

        // Map sentiments to include tickerId
        const sentimentsWithId = sentiments.map(s => ({
            articleId: s.articleId,
            tickerId: symbolToId.get(s.tickerSymbol)!,
            tickerSentimentScore: s.tickerSentimentScore,
            tickerSentimentLabel: s.tickerSentimentLabel,
            relevanceScore: s.relevanceScore,
        }));

        // Bulk upsert sentiments
        await tx.insert(newsArticleTickers).values(sentimentsWithId as NewNewsArticleTicker[]).onDuplicateKeyUpdate({
            set: {
                tickerSentimentScore: sql`VALUES(\`ticker_sentiment_score\`)`,
                tickerSentimentLabel: sql`VALUES(\`ticker_sentiment_label\`)`,
                relevanceScore: sql`VALUES(\`relevance_score\`)`,
            },
        });
    });
}

/**
 * This is a placeholder function for pre-seeding the database with initial data.
 */
export async function preSeed() {
    const tickers: NewTicker[] = [
        { symbol: "AAPL", type: "stock" },
        { symbol: "ABBV", type: "stock" },
        { symbol: "AMD", type: "stock" },
        { symbol: "AMZN", type: "stock" },
        { symbol: "ASCCF", type: "stock" },
        { symbol: "AVGO", type: "stock" },
        { symbol: "AXP", type: "stock" },
        { symbol: "BAC", type: "stock" },
        { symbol: "BA", type: "stock" },
        { symbol: "BFLY", type: "stock" },
        { symbol: "BHC", type: "stock" },
        { symbol: "BBBY", type: "stock" },
        { symbol: "BBBYQ", type: "stock" },
        { symbol: "BSQKZ", type: "stock" },
        { symbol: "BRK-A", type: "stock" },
        { symbol: "CADE-P-A", type: "stock" },
        { symbol: "CAR", type: "stock" },
        { symbol: "CMG", type: "stock" },
        { symbol: "COIN", type: "stock" },
        { symbol: "BTC", type: "crypto" },
        { symbol: "CVX", type: "stock" },
        { symbol: "D", type: "stock" },
        { symbol: "DELL", type: "stock" },
        { symbol: "ENPH", type: "stock" },
        { symbol: "FTRK", type: "stock" },
        { symbol: "GILD", type: "stock" },
        { symbol: "GOOG", type: "stock" },
        { symbol: "GS", type: "stock" },
        { symbol: "IONQ", type: "stock" },
        { symbol: "IVZ", type: "stock" },
        { symbol: "JNJ", type: "stock" },
        { symbol: "KDP", type: "stock" },
        { symbol: "KO", type: "stock" },
        { symbol: "MGNI", type: "stock" },
        { symbol: "MP", type: "stock" },
        { symbol: "MSFT", type: "stock" },
        { symbol: "NVS", type: "stock" },
        { symbol: "NXPI", type: "stock" },
        { symbol: "NVDA", type: "stock" },
        { symbol: "NUE", type: "stock" },
        { symbol: "OXY", type: "stock" },
        { symbol: "PLYM", type: "stock" },
        { symbol: "RBLX", type: "stock" },
        { symbol: "RCL", type: "stock" },
        { symbol: "RIOT", type: "stock" },
        { symbol: "ROKU", type: "stock" },
        { symbol: "RNA", type: "stock" },
        { symbol: "SIRI", type: "stock" },
        { symbol: "SCHW", type: "stock" },
        { symbol: "SOFI", type: "stock" },
        { symbol: "SPY", type: "stock" },
        { symbol: "TSM", type: "stock" },
        { symbol: "TTD", type: "stock" },
        { symbol: "TSLA", type: "stock" },
        { symbol: "V", type: "stock" },
        { symbol: "VZ", type: "stock" },
        { symbol: "VTI", type: "stock" },
        { symbol: "WM", type: "stock" },
        { symbol: "WMT", type: "stock" },
        { symbol: "XIACY", type: "stock" },
        { symbol: "XOM", type: "stock" },
        { symbol: "META", type: "stock" },
        { symbol: "ETH", type: "crypto" },
        { symbol: "BNB", type: "crypto" },
        { symbol: "SOL", type: "crypto" },
        { symbol: "ADA", type: "crypto" },
        { symbol: "XRP", type: "crypto" }
    ];
    await bulkCreateTickers(tickers);

    const articles: NewNewsArticle[] = [
        {
            articleId: getArticleId("https://www.fool.com/coverage/etfs/2025/10/29/vti-offers-broader-market-exposure-than-vtv/"),
            title: "VTI Offers Broader Market Exposure Than VTV",
            url: "https://www.fool.com/coverage/etfs/2025/10/29/vti-offers-broader-market-exposure-than-vtv/",
            publishedAt: getDateFromCompact("20251029T001936"),
            summary: "Vanguard Total Stock Market ETF ( NYSEMKT:VTI ) covers the entire U.S. stock market, while Vanguard Value ETF ( NYSEMKT:VTV ) focuses on large-cap value stocks, offering higher yield and sector tilts.Vanguard Value ETF tracks the CRSP US Large Cap Value Index, targeting established value stocks"
        },
        {
            articleId: getArticleId("https://www.benzinga.com/analyst-stock-ratings/reiteration/25/10/48439252/apple-iphone-17-foldable-will-be-the-real-game-changer-analyst"),
            title: "Apple Foldable iPhone Will Be A Game-Changer: Analyst",
            url: "https://www.benzinga.com/analyst-stock-ratings/reiteration/25/10/48439252/apple-iphone-17-foldable-will-be-the-real-game-changer-analyst",
            publishedAt: getDateFromCompact("20251027T161546"),
            summary: "Growing enthusiasm around Apple Inc's iPhone 17 demand and anticipation for next year's foldable iPhone 18 has analysts optimistic about the company's multi-year growth outlook."
        },
        {
            articleId: getArticleId("https://www.zacks.com/stock/news/2778057/netflix-plunges-12-post-q3-earnings-buy-sell-or-hold-the-stock"),
            title: "Netflix Plunges 12% Post Q3 Earnings: Buy, Sell or Hold the Stock?",
            url: "https://www.zacks.com/stock/news/2778057/netflix-plunges-12-post-q3-earnings-buy-sell-or-hold-the-stock",
            publishedAt: getDateFromCompact("20251027T154700"),
            summary: "NFLX drops 12% post-Q3 on Brazilian tax miss. Ad revenues are doubling, and live streaming is expanding. Hold current shares; wait for a better entry."
        },
        {
            articleId: getArticleId("https://www.fool.com/investing/2025/10/27/2-top-tech-stocks-to-buy-for-2026/"),
            title: "2 Top Tech Stocks to Buy for 2026",
            url: "https://www.fool.com/investing/2025/10/27/2-top-tech-stocks-to-buy-for-2026/",
            publishedAt: getDateFromCompact("20251027T151900"),
            summary: "These companies are finishing 2025 with momentum."
        },
        {
            articleId: getArticleId("https://www.benzinga.com/markets/tech/25/10/48425089/apple-maps-reportedly-plans-to-showing-ads-next-year-potential-consumer-backlash-or-a-one-up-on-goog"),
            title: "Apple Maps Reportedly Plans To Showing Ads Next Year: Potential Consumer Backlash Or A One-Up On Google Maps?",
            url: "https://www.benzinga.com/markets/tech/25/10/48425089/apple-maps-reportedly-plans-to-showing-ads-next-year-potential-consumer-backlash-or-a-one-up-on-goog",
            publishedAt: getDateFromCompact("20251027T021808"),
            summary: "Apple reportedly plans to add advertisements to Maps starting next year, raising questions about user backlash and competitive dynamics with Google Maps."
        }
    ];
    await bulkCreateNewsArticles(articles);

    const sentiments = [
        { articleId: getArticleId("https://www.fool.com/coverage/etfs/2025/10/29/vti-offers-broader-market-exposure-than-vtv/"), tickerSymbol: "MSFT", relevanceScore: "0.109705", tickerSentimentScore: "0.03158", tickerSentimentLabel: "Neutral" },
        { articleId: getArticleId("https://www.fool.com/coverage/etfs/2025/10/29/vti-offers-broader-market-exposure-than-vtv/"), tickerSymbol: "NVDA", relevanceScore: "0.109705", tickerSentimentScore: "0.03158", tickerSentimentLabel: "Neutral" },
        { articleId: getArticleId("https://www.fool.com/coverage/etfs/2025/10/29/vti-offers-broader-market-exposure-than-vtv/"), tickerSymbol: "AAPL", relevanceScore: "0.109705", tickerSentimentScore: "0.03158", tickerSentimentLabel: "Neutral" },
        { articleId: getArticleId("https://www.fool.com/coverage/etfs/2025/10/29/vti-offers-broader-market-exposure-than-vtv/"), tickerSymbol: "BRK-A", relevanceScore: "0.109705", tickerSentimentScore: "0.127025", tickerSentimentLabel: "Neutral" },
        { articleId: getArticleId("https://www.fool.com/coverage/etfs/2025/10/29/vti-offers-broader-market-exposure-than-vtv/"), tickerSymbol: "XOM", relevanceScore: "0.109705", tickerSentimentScore: "0.240894", tickerSentimentLabel: "Somewhat-Bullish" },
        { articleId: getArticleId("https://www.benzinga.com/analyst-stock-ratings/reiteration/25/10/48439252/apple-iphone-17-foldable-will-be-the-real-game-changer-analyst"), tickerSymbol: "GOOG", relevanceScore: "0.188193", tickerSentimentScore: "0.218426", tickerSentimentLabel: "Somewhat-Bullish" },
        { articleId: getArticleId("https://www.benzinga.com/analyst-stock-ratings/reiteration/25/10/48439252/apple-iphone-17-foldable-will-be-the-real-game-changer-analyst"), tickerSymbol: "AAPL", relevanceScore: "0.366061", tickerSentimentScore: "0.394064", tickerSentimentLabel: "Bullish" },
        { articleId: getArticleId("https://www.zacks.com/stock/news/2778057/netflix-plunges-12-post-q3-earnings-buy-sell-or-hold-the-stock"), tickerSymbol: "NFLX", relevanceScore: "0.405963", tickerSentimentScore: "0.333318", tickerSentimentLabel: "Somewhat-Bullish" },
        { articleId: getArticleId("https://www.zacks.com/stock/news/2778057/netflix-plunges-12-post-q3-earnings-buy-sell-or-hold-the-stock"), tickerSymbol: "GOOG", relevanceScore: "0.030369", tickerSentimentScore: "0.158411", tickerSentimentLabel: "Somewhat-Bullish" },
        { articleId: getArticleId("https://www.zacks.com/stock/news/2778057/netflix-plunges-12-post-q3-earnings-buy-sell-or-hold-the-stock"), tickerSymbol: "AAPL", relevanceScore: "0.150969", tickerSentimentScore: "0.074297", tickerSentimentLabel: "Neutral" },
        { articleId: getArticleId("https://www.zacks.com/stock/news/2778057/netflix-plunges-12-post-q3-earnings-buy-sell-or-hold-the-stock"), tickerSymbol: "AMZN", relevanceScore: "0.150969", tickerSentimentScore: "0.074297", tickerSentimentLabel: "Neutral" },
        { articleId: getArticleId("https://www.fool.com/investing/2025/10/27/2-top-tech-stocks-to-buy-for-2026/"), tickerSymbol: "AMD", relevanceScore: "0.342093", tickerSentimentScore: "0.059633", tickerSentimentLabel: "Neutral" },
        { articleId: getArticleId("https://www.fool.com/investing/2025/10/27/2-top-tech-stocks-to-buy-for-2026/"), tickerSymbol: "AAPL", relevanceScore: "0.624172", tickerSentimentScore: "0.670171", tickerSentimentLabel: "Bullish" },
        { articleId: getArticleId("https://www.benzinga.com/markets/tech/25/10/48425089/apple-maps-reportedly-plans-to-showing-ads-next-year-potential-consumer-backlash-or-a-one-up-on-goog"), tickerSymbol: "GOOG", relevanceScore: "0.259727", tickerSentimentScore: "-0.070728", tickerSentimentLabel: "Neutral" },
        { articleId: getArticleId("https://www.benzinga.com/markets/tech/25/10/48425089/apple-maps-reportedly-plans-to-showing-ads-next-year-potential-consumer-backlash-or-a-one-up-on-goog"), tickerSymbol: "AAPL", relevanceScore: "0.815149", tickerSentimentScore: "0.444723", tickerSentimentLabel: "Bullish" }
    ];
    await bulkUpsertArticleTickerSentiments(sentiments);
}