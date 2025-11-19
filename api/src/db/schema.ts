import { relations } from "drizzle-orm";
import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
    boolean,
    char,
    decimal,
    int,
    mysqlEnum,
    mysqlTable,
    primaryKey,
    text,
    timestamp,
    uniqueIndex,
    index,
    varchar,
} from "drizzle-orm/mysql-core";
// PK = Primary key FK = Foreign key UQ = Unique index IDX = Non-unique index
/**
 * users — Cognito `sub` is the PK. Single global notifications toggle.
 */
export const users = mysqlTable(
    "users",
    {
        userId: varchar("user_id", { length: 191 }).primaryKey(),
        email: varchar("email", { length: 254 }).notNull(),
        notificationEnabled: boolean("notification_enabled").notNull().default(true),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        updatedAt: timestamp("updated_at"),
    },
    (t) => ({
        emailUq: uniqueIndex("users_email_uq").on(t.email),
    })
);

export const sessions = mysqlTable(
    "sessions",
    {
        sessionId: varchar("session_id", { length: 191 }).primaryKey(),
        userId: varchar("user_id", { length: 191 })
            .notNull()
            .references(() => users.userId, { onDelete: "cascade", onUpdate: "cascade" }),
        createdAt: timestamp("created_at").defaultNow().notNull(),
        expiresAt: timestamp("expires_at").notNull(),
    },
    (t) => ({
        userIdx: index("sessions_user_idx").on(t.userId),
        expiresAtIdx: index("sessions_expires_at_idx").on(t.expiresAt),
    })
);

/**
 * tickers — normalized symbols and asset type.
 */
export const tickers = mysqlTable(
    "tickers",
    {
        tickerId: int("ticker_id").autoincrement().primaryKey(),
        symbol: varchar("symbol", { length: 32 }).notNull(), // e.g., AAPL, BTC
        type: mysqlEnum("ticker_type", ["stock", "crypto"]).notNull(),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (t) => ({
        symbolTypeUq: uniqueIndex("tickers_symbol_type_uq").on(t.symbol, t.type),
        symbolIdx: index("tickers_symbol_idx").on(t.symbol),
        typeIdx: index("tickers_type_idx").on(t.type),
    })
);

/**
 * user_watchlist — per-user tracking of tickers.
 */
export const userWatchlist = mysqlTable(
    "user_watchlist",
    {
        watchlistId: int("watchlist_id").autoincrement().primaryKey(),
        userId: varchar("user_id", { length: 191 })
            .notNull()
            .references(() => users.userId, { onDelete: "cascade", onUpdate: "cascade" }),
        tickerId: int("ticker_id")
            .notNull()
            .references(() => tickers.tickerId, { onDelete: "restrict", onUpdate: "cascade" }),
        notificationEnabled: boolean("notification_enabled").notNull().default(true),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (t) => ({
        userIdx: index("user_watchlist_user_idx").on(t.userId),
        tickerIdx: index("user_watchlist_ticker_idx").on(t.tickerId),
        userTickerUq: uniqueIndex("user_watchlist_user_ticker_uq").on(t.userId, t.tickerId),
    })
);

/**
 * news_articles — article_id is sha256(url) hex (compute in app).
 */
export const newsArticles = mysqlTable(
    "news_articles",
    {
        articleId: char("article_id", { length: 64 }).primaryKey(), // sha256(url) hex
        url: varchar("url", { length: 2048 }).notNull(),
        sourceDomain: varchar("source_domain", { length: 255 }),
        title: text("title").notNull(),
        summary: text("summary"),
        overallSentimentScore: decimal("overall_sentiment_score", { precision: 5, scale: 4 }), // -1.0000..1.0000
        overallSentimentLabel: varchar("overall_sentiment_label", { length: 32 }),
        publishedAt: timestamp("published_at"),
        createdAt: timestamp("created_at").defaultNow().notNull(),
    },
    (t) => ({
        publishedIdx: index("news_articles_published_idx").on(t.publishedAt),
        sourceDomainIdx: index("news_articles_source_domain_idx").on(t.sourceDomain),
    })
);

/**
 * news_article_tickers — per-ticker sentiment for each article.
 */
export const newsArticleTickers = mysqlTable(
    "news_article_tickers",
    {
        articleId: char("article_id", { length: 64 })
            .notNull()
            .references(() => newsArticles.articleId, { onDelete: "cascade", onUpdate: "cascade" }),
        tickerId: int("ticker_id")
            .notNull()
            .references(() => tickers.tickerId, { onDelete: "restrict", onUpdate: "cascade" }),
        tickerSentimentScore: decimal("ticker_sentiment_score", { precision: 5, scale: 4 }), // -1.0000..1.0000
        tickerSentimentLabel: varchar("ticker_sentiment_label", { length: 32 }),
        relevanceScore: decimal("relevance_score", { precision: 4, scale: 3 }), // 0.000..1.000
    },
    (t) => ({
        pk: primaryKey({ name: "news_article_tickers_pk", columns: [t.articleId, t.tickerId] }),
    })
);

/**
 * Relations.
 */
export const usersRelations = relations(users, ({ many }) => ({
    watchlists: many(userWatchlist),
}));

export const tickersRelations = relations(tickers, ({ many }) => ({
    watchlists: many(userWatchlist),
    articles: many(newsArticleTickers),
}));

export const userWatchlistRelations = relations(userWatchlist, ({ one }) => ({
    user: one(users, { fields: [userWatchlist.userId], references: [users.userId] }),
    ticker: one(tickers, { fields: [userWatchlist.tickerId], references: [tickers.tickerId] }),
}));

export const newsArticlesRelations = relations(newsArticles, ({ many }) => ({
    tickers: many(newsArticleTickers),
}));

export const newsArticleTickersRelations = relations(newsArticleTickers, ({ one }) => ({
    article: one(newsArticles, {
        fields: [newsArticleTickers.articleId],
        references: [newsArticles.articleId],
    }),
    ticker: one(tickers, {
        fields: [newsArticleTickers.tickerId],
        references: [tickers.tickerId],
    }),
}));

/**
 * Handy TS types.
 */
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Ticker = InferSelectModel<typeof tickers>;
export type NewTicker = InferInsertModel<typeof tickers>;

export type UserWatchlist = InferSelectModel<typeof userWatchlist>;
export type NewUserWatchlist = InferInsertModel<typeof userWatchlist>;

export type NewsArticle = InferSelectModel<typeof newsArticles>;
export type NewNewsArticle = InferInsertModel<typeof newsArticles>;

export type NewsArticleTicker = InferSelectModel<typeof newsArticleTickers>;
export type NewNewsArticleTicker = InferInsertModel<typeof newsArticleTickers>;
