# API Routes Documentation

This document provides an overview of the API routes available in the application, including their endpoints, methods, and required parameters.

## Article Route (`/api/articles`)

- **GET /**  
  Retrieves all articles with ticker sentiments. Requires authentication.

- **GET /findSentiments/:tickerSymbol**  
  Retrieves articles with sentiments for the specified ticker symbol.

- **POST /**  
  Creates a new news article.  
  Body:
  ```
  {
    title: string,
    url: string,
    summary?: string,
    publishedAt?: string
  }
  ```

- **POST /:articleId/tickers**  
  Upserts sentiment for a ticker on an article.  
  Body:
  ```
  {
    tickerSymbol: string,
    tickerSentimentScore?: string|number|null,
    tickerSentimentLabel?: string|null,
    relevanceScore?: string|number|null
  }
  ```

- **GET /:articleId/tickers**  
  Retrieves sentiments for all tickers on the specified article.

- **GET /findArticleId**  
  Retrieves articleId by URL.  
  Body:
  ```
  {
    url: string
  }
  ```

## Auth Routes (`/api/auth`)

- **GET /login**  
  Initiates the OAuth login process.

- **GET /callback**  
  Handles the OAuth callback after login.

- **GET /session**  
  Retrieves the current user session.

- **POST /logout**  
  Logs out the user and clears the session.

## Ticker Routes (`/api/tickers`)

- **POST /**  
  Creates a new ticker. Requires authentication.  
  Body:
  ```
  {
    symbol: string,
    type: "stock" | "crypto"
  }
  ```

- **GET /byType/:type**  
  Retrieves tickers by type (use "all" for all tickers).

- **GET /:symbol**  
  Retrieves information for the specified ticker symbol.

- **DELETE /:symbol**  
  Deletes the specified ticker.

## User Routes (`/api/users`)

- **PATCH /notifications**  
  Toggles global notifications for the user. Requires authentication.  
  Body:
  ```
  {
    enabled: boolean
  }
  ```

- **POST /watchlist**  
  Adds a ticker to the user's watchlist (creates ticker if missing). Requires authentication.  
  Body:
  ```
  {
    symbol: string,
    type?: "stock" | "crypto",
    notificationEnabled?: boolean
  }
  ```

- **PATCH /watchlist/:symbol/notifications**  
  Sets per-ticker watchlist notifications. Requires authentication.  
  Body:
  ```
  {
    enabled: boolean,
    type?: "stock" | "crypto"
  }
  ```

- **DELETE /watchlist/:symbol**  
  Removes a ticker from the user's watchlist. Requires authentication.

- **GET /watchlist**  
  Retrieves all tickers in the user's watchlist. Requires authentication.
