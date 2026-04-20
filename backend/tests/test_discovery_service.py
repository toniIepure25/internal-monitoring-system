"""Tests for health endpoint discovery scoring logic."""
import pytest
from app.services.discovery_service import _build_candidate_urls, _score_candidate


class TestDiscoveryScoring:

    def test_perfect_health_endpoint(self):
        # Score: 30 (200) + 20 (json) + 20 (keywords "up","healthy") + 20 (status key) + 10 (fast) = 100
        score, is_json, has_indicators = _score_candidate(
            url="https://service.internal/health",
            http_status=200,
            response_time_ms=50,
            content_type="application/json",
            body='{"status": "UP", "healthy": true}',
        )
        assert score == 100.0
        assert is_json is True
        assert has_indicators is True

    def test_non_json_200_response(self):
        score, is_json, _ = _score_candidate(
            url="https://service.internal/health",
            http_status=200,
            response_time_ms=100,
            content_type="text/plain",
            body="OK",
        )
        assert score == 90.0
        assert is_json is False

    def test_json_without_health_keywords(self):
        score, is_json, has_indicators = _score_candidate(
            url="https://service.internal/version",
            http_status=200,
            response_time_ms=100,
            content_type="application/json",
            body='{"version": "1.0", "build": "abc123"}',
        )
        assert score == 60.0
        assert is_json is True
        assert has_indicators is False

    def test_500_error(self):
        # 500 gets no HTTP score, but fast response still gives +10
        score, _, _ = _score_candidate(
            url="https://service.internal/login",
            http_status=500,
            response_time_ms=100,
            content_type="text/plain",
            body="Internal Server Error",
        )
        assert score == 0.0

    def test_no_response(self):
        score, _, _ = _score_candidate(
            url="https://service.internal/health",
            http_status=None,
            response_time_ms=None,
            content_type=None,
            body=None,
        )
        assert score == 0.0

    def test_slow_response_penalty(self):
        score_fast, _, _ = _score_candidate(
            url="https://service.internal/health",
            http_status=200,
            response_time_ms=100,
            content_type="text/plain",
            body="ok",
        )
        score_slow, _, _ = _score_candidate(
            url="https://service.internal/health",
            http_status=200,
            response_time_ms=5000,
            content_type="text/plain",
            body="ok",
        )
        assert score_fast > score_slow

    def test_json_with_status_field(self):
        # "healthy" substring matches keyword. Score: 30+20+20+20+10 = 100 (capped)
        score, _, has_indicators = _score_candidate(
            url="https://service.internal/health",
            http_status=200,
            response_time_ms=50,
            content_type="application/json",
            body='{"status": "healthy"}',
        )
        assert score == 100.0
        assert has_indicators is True

    def test_204_no_content(self):
        score, _, _ = _score_candidate(
            url="https://service.internal/ready",
            http_status=204,
            response_time_ms=50,
            content_type=None,
            body=None,
        )
        assert score == 55.0

    def test_login_page_is_penalized(self):
        score, _, _ = _score_candidate(
            url="https://service.internal/login",
            http_status=200,
            response_time_ms=80,
            content_type="text/html",
            body="<html><title>Sign In</title></html>",
        )
        assert score < 30.0

    def test_build_candidate_urls_includes_root_and_nested_path_variants(self):
        urls = _build_candidate_urls("https://service.internal/app")
        assert "https://service.internal/app" in urls
        assert "https://service.internal/app/health" in urls
        assert "https://service.internal/health" in urls
