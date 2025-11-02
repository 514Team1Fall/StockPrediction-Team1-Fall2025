import express, { type Express } from "express";
import dotenv from "dotenv";
import http from 'http';
import tickerRouter from "./api/routes/ticker.js";
import articleRouter from "./api/routes/article.js";
import userRouter from "./api/routes/user.js";
import { authRouter } from "./api/routes/auth.js";
import cors from 'cors';

import cookieParser from "cookie-parser";
import { preSeed } from "./db/db_api.js";
dotenv.config();

const app: Express = express();
const port = process.env.PORT || 5000;

const TICKER_API_ROUTE = '/api/tickers';
const ARTICLE_API_ROUTE = '/api/articles';
const USER_API_ROUTE = '/api/users';
const AUTH_API_ROUTE = '/api/auth';

app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5000',
}));
app.use(express.json());
app.use(cookieParser());

app.use(TICKER_API_ROUTE, tickerRouter);
app.use(ARTICLE_API_ROUTE, articleRouter);
app.use(USER_API_ROUTE, userRouter);
app.use(AUTH_API_ROUTE, authRouter);

app.get("/seed", async (req, res) => {
    await preSeed();
    res.json({ message: "Pre-Seeded Data" });
});


try {
    const httpServer = http.createServer(app);
    httpServer.listen(port, () => {
        console.log(`Server: HTTP Server now running at http://localhost:${port}`);
    });
} catch (error) {
    console.error('Failed to start HTTP server:', error);
}
