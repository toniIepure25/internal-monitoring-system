"""Tests for URL normalization utility."""
import pytest
from app.utils.url import normalize_url


class TestURLNormalization:

    def test_basic_normalization(self):
        assert normalize_url("https://example.com") == "https://example.com"

    def test_trailing_slash_removed(self):
        assert normalize_url("https://example.com/") == "https://example.com"

    def test_www_prefix_removed(self):
        assert normalize_url("https://www.example.com") == "https://example.com"

    def test_default_https_port_removed(self):
        assert normalize_url("https://example.com:443") == "https://example.com"

    def test_default_http_port_removed(self):
        assert normalize_url("http://example.com:80") == "http://example.com"

    def test_non_default_port_preserved(self):
        assert normalize_url("https://example.com:8443") == "https://example.com:8443"

    def test_host_lowercased(self):
        assert normalize_url("https://EXAMPLE.COM") == "https://example.com"

    def test_scheme_lowercased(self):
        assert normalize_url("HTTPS://example.com") == "https://example.com"

    def test_path_preserved(self):
        assert normalize_url("https://example.com/api/v1") == "https://example.com/api/v1"

    def test_path_trailing_slash_removed(self):
        assert normalize_url("https://example.com/api/") == "https://example.com/api"

    def test_no_scheme_defaults_to_https(self):
        assert normalize_url("example.com") == "https://example.com"

    def test_query_params_sorted(self):
        result = normalize_url("https://example.com?b=2&a=1")
        assert "a=1" in result
        assert "b=2" in result

    def test_same_url_different_formats_normalize_same(self):
        urls = [
            "https://www.Example.COM:443/app/",
            "https://example.com/app",
            "HTTPS://WWW.EXAMPLE.COM/app/",
        ]
        normalized = [normalize_url(u) for u in urls]
        assert all(n == normalized[0] for n in normalized)

    def test_whitespace_stripped(self):
        assert normalize_url("  https://example.com  ") == "https://example.com"
