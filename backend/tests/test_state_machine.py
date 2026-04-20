"""Tests for the monitoring state machine transition logic."""
import pytest
from app.models.application_status import AppState
from app.services.monitoring_service import CheckResult, evaluate_transition

FAILURES_THRESHOLD = 3
RECOVERY_THRESHOLD = 2


class TestStateTransitions:
    """Test all state machine transitions with thresholds."""

    def test_unknown_to_up_on_healthy(self):
        new_state, failures, successes = evaluate_transition(
            current_state=AppState.UNKNOWN,
            check=CheckResult(success=True),
            consecutive_failures=0,
            consecutive_successes=0,
            failures_threshold=FAILURES_THRESHOLD,
            recovery_threshold=RECOVERY_THRESHOLD,
        )
        assert new_state == AppState.UP
        assert failures == 0
        assert successes == 1

    def test_unknown_stays_unknown_on_single_failure(self):
        new_state, failures, successes = evaluate_transition(
            current_state=AppState.UNKNOWN,
            check=CheckResult(success=False, error="timeout"),
            consecutive_failures=0,
            consecutive_successes=0,
            failures_threshold=FAILURES_THRESHOLD,
            recovery_threshold=RECOVERY_THRESHOLD,
        )
        assert new_state == AppState.UNKNOWN
        assert failures == 1
        assert successes == 0

    def test_unknown_to_down_after_threshold_failures(self):
        new_state, failures, successes = evaluate_transition(
            current_state=AppState.UNKNOWN,
            check=CheckResult(success=False),
            consecutive_failures=FAILURES_THRESHOLD - 1,
            consecutive_successes=0,
            failures_threshold=FAILURES_THRESHOLD,
            recovery_threshold=RECOVERY_THRESHOLD,
        )
        assert new_state == AppState.DOWN
        assert failures == FAILURES_THRESHOLD

    def test_up_stays_up_on_healthy(self):
        new_state, _, _ = evaluate_transition(
            current_state=AppState.UP,
            check=CheckResult(success=True),
            consecutive_failures=0,
            consecutive_successes=5,
            failures_threshold=FAILURES_THRESHOLD,
            recovery_threshold=RECOVERY_THRESHOLD,
        )
        assert new_state == AppState.UP

    def test_up_to_slow_on_slow_response(self):
        new_state, _, _ = evaluate_transition(
            current_state=AppState.UP,
            check=CheckResult(success=True, is_slow=True),
            consecutive_failures=0,
            consecutive_successes=5,
            failures_threshold=FAILURES_THRESHOLD,
            recovery_threshold=RECOVERY_THRESHOLD,
        )
        assert new_state == AppState.SLOW

    def test_up_to_degraded_on_degraded_response(self):
        new_state, _, _ = evaluate_transition(
            current_state=AppState.UP,
            check=CheckResult(success=True, is_degraded=True),
            consecutive_failures=0,
            consecutive_successes=5,
            failures_threshold=FAILURES_THRESHOLD,
            recovery_threshold=RECOVERY_THRESHOLD,
        )
        assert new_state == AppState.DEGRADED

    def test_up_stays_up_on_single_failure(self):
        new_state, failures, _ = evaluate_transition(
            current_state=AppState.UP,
            check=CheckResult(success=False),
            consecutive_failures=0,
            consecutive_successes=10,
            failures_threshold=FAILURES_THRESHOLD,
            recovery_threshold=RECOVERY_THRESHOLD,
        )
        assert new_state == AppState.UP
        assert failures == 1

    def test_up_to_down_after_threshold_failures(self):
        new_state, _, _ = evaluate_transition(
            current_state=AppState.UP,
            check=CheckResult(success=False),
            consecutive_failures=FAILURES_THRESHOLD - 1,
            consecutive_successes=0,
            failures_threshold=FAILURES_THRESHOLD,
            recovery_threshold=RECOVERY_THRESHOLD,
        )
        assert new_state == AppState.DOWN

    def test_down_stays_down_on_single_success(self):
        new_state, _, successes = evaluate_transition(
            current_state=AppState.DOWN,
            check=CheckResult(success=True),
            consecutive_failures=5,
            consecutive_successes=0,
            failures_threshold=FAILURES_THRESHOLD,
            recovery_threshold=RECOVERY_THRESHOLD,
        )
        assert new_state == AppState.DOWN
        assert successes == 1

    def test_down_to_up_after_recovery_threshold(self):
        new_state, failures, successes = evaluate_transition(
            current_state=AppState.DOWN,
            check=CheckResult(success=True),
            consecutive_failures=0,
            consecutive_successes=RECOVERY_THRESHOLD - 1,
            failures_threshold=FAILURES_THRESHOLD,
            recovery_threshold=RECOVERY_THRESHOLD,
        )
        assert new_state == AppState.UP
        assert failures == 0
        assert successes == RECOVERY_THRESHOLD

    def test_slow_to_down_after_failures(self):
        new_state, _, _ = evaluate_transition(
            current_state=AppState.SLOW,
            check=CheckResult(success=False),
            consecutive_failures=FAILURES_THRESHOLD - 1,
            consecutive_successes=0,
            failures_threshold=FAILURES_THRESHOLD,
            recovery_threshold=RECOVERY_THRESHOLD,
        )
        assert new_state == AppState.DOWN

    def test_slow_to_up_after_recovery(self):
        new_state, _, _ = evaluate_transition(
            current_state=AppState.SLOW,
            check=CheckResult(success=True),
            consecutive_failures=0,
            consecutive_successes=RECOVERY_THRESHOLD - 1,
            failures_threshold=FAILURES_THRESHOLD,
            recovery_threshold=RECOVERY_THRESHOLD,
        )
        assert new_state == AppState.UP

    def test_degraded_to_up_after_recovery(self):
        new_state, _, _ = evaluate_transition(
            current_state=AppState.DEGRADED,
            check=CheckResult(success=True),
            consecutive_failures=0,
            consecutive_successes=RECOVERY_THRESHOLD - 1,
            failures_threshold=FAILURES_THRESHOLD,
            recovery_threshold=RECOVERY_THRESHOLD,
        )
        assert new_state == AppState.UP

    def test_degraded_to_down_after_failures(self):
        new_state, _, _ = evaluate_transition(
            current_state=AppState.DEGRADED,
            check=CheckResult(success=False),
            consecutive_failures=FAILURES_THRESHOLD - 1,
            consecutive_successes=0,
            failures_threshold=FAILURES_THRESHOLD,
            recovery_threshold=RECOVERY_THRESHOLD,
        )
        assert new_state == AppState.DOWN

    def test_down_stays_down_on_failure(self):
        new_state, failures, _ = evaluate_transition(
            current_state=AppState.DOWN,
            check=CheckResult(success=False),
            consecutive_failures=10,
            consecutive_successes=0,
            failures_threshold=FAILURES_THRESHOLD,
            recovery_threshold=RECOVERY_THRESHOLD,
        )
        assert new_state == AppState.DOWN
        assert failures == 11

    def test_failure_resets_success_counter(self):
        _, failures, successes = evaluate_transition(
            current_state=AppState.DOWN,
            check=CheckResult(success=False),
            consecutive_failures=2,
            consecutive_successes=1,
            failures_threshold=FAILURES_THRESHOLD,
            recovery_threshold=RECOVERY_THRESHOLD,
        )
        assert successes == 0
        assert failures == 3

    def test_success_resets_failure_counter(self):
        _, failures, successes = evaluate_transition(
            current_state=AppState.UP,
            check=CheckResult(success=True),
            consecutive_failures=2,
            consecutive_successes=0,
            failures_threshold=FAILURES_THRESHOLD,
            recovery_threshold=RECOVERY_THRESHOLD,
        )
        assert failures == 0
        assert successes == 1
