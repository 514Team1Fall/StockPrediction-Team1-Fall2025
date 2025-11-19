import os
import json
import hashlib
import urllib.parse
import urllib.request
import boto3

ALPHA_ENDPOINT = 'https://www.alphavantage.co/query?function=NEWS_SENTIMENT'

def fetch_json(url: str, method: str = 'GET', body: dict | None = None, timeout_sec: int = 20) -> dict:
    data = None
    headers = {'Content-Type': 'application/json'}
    if body is not None:
        data = json.dumps(body).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=timeout_sec) as resp:
        charset = resp.headers.get_content_charset() or 'utf-8'
        text = resp.read().decode(charset)
        if resp.status < 200 or resp.status >= 300:
            raise RuntimeError(f"HTTP {resp.status} for {url}: {text}")
        return json.loads(text)


def compute_article_id(url: str) -> str:
    h = hashlib.sha256()
    h.update((url or "").strip().encode('utf-8'))
    return h.hexdigest()


def ingest_batch(api_key: str, all_articles: list, all_sentiments: list) -> None:
    url = f"{ALPHA_ENDPOINT}&apikey={urllib.parse.quote(api_key)}"
    data = fetch_json(url)
    feed = data.get('feed') or data.get('articles') or []
    comprehend = boto3.client('comprehend')
    for item in feed:
        try:
            # Overall sentiment with Comprehend (combine title + summary; English)
            try:
                title = item.get("title") or ""
                summary = item.get("summary") or ""
                text = (title + ". " + summary).strip()
                if text:
                    res = comprehend.detect_sentiment(Text=text[:4800], LanguageCode='en')
                    label = res.get("Sentiment")
                    scores = res.get("SentimentScore", {})
                    signed = float(scores.get("Positive", 0.0)) - float(scores.get("Negative", 0.0))
                    item["overallSentimentLabel"] = label
                    item["overallSentimentScore"] = round(signed, 4)
            except Exception as se:
                print(f"ERROR comprehend sentiment: {se}")

            article_id = compute_article_id(item.get("url"))
            article = {
                "articleId": article_id,
                "title": item.get("title"),
                "url": item.get("url"),
                "summary": item.get("summary"),
                "publishedAt": item.get("time_published") or item.get("published_at"),
                "overallSentimentScore": item.get("overallSentimentScore"),
                "overallSentimentLabel": item.get("overallSentimentLabel"),
            }
            all_articles.append(article)

            # Per-ticker sentiment: reuse overall text for each ticker (approx)
            sentiments = item.get('ticker_sentiment') or []
            for s in sentiments:
                ticker = s.get("ticker", "").split(":")[-1]  # Strip prefix
                if ticker:
                    # Compute sentiment per ticker using the same text (or contextualize if possible)
                    try:
                        if text:
                            res = comprehend.detect_sentiment(Text=text[:4800], LanguageCode='en')
                            ticker_label = res.get("Sentiment")
                            ticker_scores = res.get("SentimentScore", {})
                            ticker_signed = float(ticker_scores.get("Positive", 0.0)) - float(ticker_scores.get("Negative", 0.0))
                        else:
                            ticker_label = None
                            ticker_signed = None
                    except Exception as te:
                        print(f"ERROR ticker sentiment for {ticker}: {te}")
                        ticker_label = None
                        ticker_signed = None

                    sentiment = {
                        "articleId": article_id,
                        "tickerSymbol": ticker,
                        "tickerSentimentScore": round(ticker_signed, 4) if ticker_signed is not None else None,
                        "tickerSentimentLabel": ticker_label,
                        "relevanceScore": s.get("relevance_score"),
                    }
                    all_sentiments.append(sentiment)
        except Exception as outer:
            print(f"ERROR processing article {item.get('url')}: {outer}")


def handler(event, context):
    api_key = os.environ.get('ALPHAVANTAGE_API_KEY')
    api_base_url = os.environ.get('API_BASE_URL')

    if not api_key or not api_base_url:
        raise RuntimeError('Missing required env: ALPHAVANTAGE_API_KEY or API_BASE_URL')

    all_articles = []
    all_sentiments = []

    ingest_batch(api_key, all_articles, all_sentiments)

    # Bulk upsert
    if all_articles or all_sentiments:
        body = {"articles": all_articles, "sentiments": all_sentiments}
        fetch_json(f"{api_base_url}/articles/bulk", method='POST', body=body)

    body = {"ok": True, "articles": len(all_articles), "sentiments": len(all_sentiments)}
    return {"statusCode": 200, "body": json.dumps(body)}
