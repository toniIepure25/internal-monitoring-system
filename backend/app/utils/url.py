from urllib.parse import urlparse, urlunparse, parse_qs, urlencode


def normalize_url(raw_url: str) -> str:
    """Normalize a URL for deduplication.

    Handles: scheme lowering, host lowering, default port removal,
    trailing slash stripping, www prefix removal, query param sorting.
    """
    url = raw_url.strip()
    if not url.lower().startswith(("http://", "https://")):
        url = "https://" + url

    parsed = urlparse(url)

    scheme = parsed.scheme.lower()
    hostname = (parsed.hostname or "").lower()

    if hostname.startswith("www."):
        hostname = hostname[4:]

    port = parsed.port
    if (scheme == "http" and port == 80) or (scheme == "https" and port == 443):
        port = None

    netloc = hostname
    if port:
        netloc = f"{hostname}:{port}"

    path = parsed.path.rstrip("/") or ""

    query_params = parse_qs(parsed.query, keep_blank_values=True)
    sorted_query = urlencode(sorted(query_params.items()), doseq=True) if query_params else ""

    normalized = urlunparse((scheme, netloc, path, "", sorted_query, ""))
    return normalized
