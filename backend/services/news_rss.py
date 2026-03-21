from datetime import datetime
from html import unescape
from typing import List, Dict

import feedparser


CRYPTO_FEEDS = [
    "https://cointelegraph.com/rss",
    "https://decrypt.co/feed",
    "https://cryptoslate.com/feed/",
    "https://cryptopotato.com/feed/",
    "https://www.coindesk.com/arc/outboundfeeds/rss/",
]


def _strip_html(text: str) -> str:
    """Best-effort HTML to plain-text cleaner without extra deps."""
    # Unescape HTML entities first (&amp;, &lt;, etc.)
    text = unescape(text)
    # Remove simple <tag>...</tag> patterns and standalone tags.
    # This is intentionally conservative; content is for LLM, not exact rendering.
    import re

    text = re.sub(r"<[^>]+>", " ", text)
    # Collapse whitespace
    return " ".join(text.split()).strip()


def _normalize_entry(entry) -> Dict[str, str]:
    title = (entry.get("title") or "").strip()

    raw_summary = (
        entry.get("summary")
        or entry.get("description")
        or ""
    )
    summary = _strip_html(raw_summary) if raw_summary else ""

    link = (entry.get("link") or "").strip()

    day_pub = None
    if entry.get("published_parsed"):
        dt = datetime(*entry.published_parsed[:6])
        day_pub = dt.date().isoformat()
    else:
        raw = (entry.get("published") or "").strip()
        day_pub = raw or None

    # Fallback: nếu summary trống, dùng lại title làm tóm tắt ngắn
    if not summary and title:
        summary = title

    return {
        "title": title,
        "content_summary": summary,
        "dayPub": day_pub,
        "link": link,
    }


def fetch_crypto_news_from_rss(limit_per_feed: int = 5) -> List[Dict[str, str]]:
    """
    Fetch crypto news from a small set of public RSS feeds (free, no API key).

    Returns a list of dicts with:
      - title
      - content_summary
      - dayPub (ISO date string if available)
      - link
    """
    articles: List[Dict[str, str]] = []

    for url in CRYPTO_FEEDS:
        feed = feedparser.parse(url)
        for entry in feed.get("entries", [])[:limit_per_feed]:
            normalized = _normalize_entry(entry)
            if normalized["title"]:
                articles.append(normalized)

    return articles
