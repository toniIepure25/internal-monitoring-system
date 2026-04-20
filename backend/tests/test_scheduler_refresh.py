"""Scheduler job registration when applications change."""
from unittest.mock import MagicMock, patch

from app.workers.scheduler import refresh_monitoring_job_for_application


def test_refresh_skips_when_scheduler_not_started():
    """No crash when _scheduler is None (e.g. tests without lifespan)."""
    with patch("app.workers.scheduler._scheduler", None):
        refresh_monitoring_job_for_application(
            "00000000-0000-4000-8000-000000000001",
            "Test",
            "http://example.com/health",
            True,
            False,
            60,
        )


def test_refresh_adds_job_when_eligible():
    mock_sched = MagicMock()
    mock_sched.get_jobs.return_value = []
    with patch("app.workers.scheduler._scheduler", mock_sched):
        refresh_monitoring_job_for_application(
            "00000000-0000-4000-8000-000000000002",
            "MyApp",
            "http://example.com/health",
            True,
            False,
            30,
        )
        mock_sched.add_job.assert_called_once()
        call_kw = mock_sched.add_job.call_args[1]
        assert call_kw["id"] == "monitor_00000000-0000-4000-8000-000000000002"
        assert call_kw["replace_existing"] is True


def test_refresh_removes_when_inactive():
    mock_sched = MagicMock()
    with patch("app.workers.scheduler._scheduler", mock_sched):
        refresh_monitoring_job_for_application(
            "00000000-0000-4000-8000-000000000003",
            "X",
            "http://example.com/h",
            False,
            False,
            60,
        )
        mock_sched.remove_job.assert_called_once_with("monitor_00000000-0000-4000-8000-000000000003")
