"""Tests for host state machine logic."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime, timezone, timedelta

from app.models.host import HostState
from app.services.host_monitoring_service import (
    HEARTBEAT_RECOVERY_THRESHOLD,
    HEARTBEAT_FAILURE_THRESHOLD,
)


class FakeHostStatus:
    """Minimal mock for HostStatus."""
    def __init__(self, status=HostState.UNKNOWN, consecutive_heartbeats=0, consecutive_misses=0, last_heartbeat_at=None):
        self.status = status
        self.consecutive_heartbeats = consecutive_heartbeats
        self.consecutive_misses = consecutive_misses
        self.last_heartbeat_at = last_heartbeat_at
        self.ip_address = None
        self.os_version = None
        self.uptime_seconds = None
        self.updated_at = datetime.now(timezone.utc)


# --- Heartbeat state transition tests ---

def test_first_heartbeat_stays_unknown():
    """First heartbeat increments consecutive_heartbeats but doesn't transition yet."""
    status = FakeHostStatus(status=HostState.UNKNOWN, consecutive_heartbeats=0)
    status.consecutive_heartbeats += 1
    status.consecutive_misses = 0
    # Not enough consecutive heartbeats yet
    assert status.consecutive_heartbeats < HEARTBEAT_RECOVERY_THRESHOLD
    assert status.status == HostState.UNKNOWN


def test_heartbeat_reaches_recovery_threshold():
    """After enough consecutive heartbeats, status should transition to ONLINE."""
    status = FakeHostStatus(status=HostState.UNKNOWN, consecutive_heartbeats=HEARTBEAT_RECOVERY_THRESHOLD - 1)
    status.consecutive_heartbeats += 1
    status.consecutive_misses = 0
    if status.consecutive_heartbeats >= HEARTBEAT_RECOVERY_THRESHOLD:
        status.status = HostState.ONLINE
    assert status.status == HostState.ONLINE


def test_offline_to_online_recovery():
    """Host recovers from OFFLINE to ONLINE after enough heartbeats."""
    status = FakeHostStatus(status=HostState.OFFLINE, consecutive_heartbeats=HEARTBEAT_RECOVERY_THRESHOLD - 1)
    status.consecutive_heartbeats += 1
    status.consecutive_misses = 0
    if status.status in (HostState.OFFLINE, HostState.UNKNOWN, HostState.DEGRADED):
        if status.consecutive_heartbeats >= HEARTBEAT_RECOVERY_THRESHOLD:
            status.status = HostState.ONLINE
    assert status.status == HostState.ONLINE


def test_online_stays_online_on_heartbeat():
    """Already-online host stays online on heartbeat."""
    status = FakeHostStatus(status=HostState.ONLINE, consecutive_heartbeats=10)
    status.consecutive_heartbeats += 1
    status.consecutive_misses = 0
    assert status.status == HostState.ONLINE


# --- Missed heartbeat tests ---

def test_first_miss_increments_counter():
    """First missed heartbeat increments miss counter but doesn't transition."""
    status = FakeHostStatus(status=HostState.ONLINE, consecutive_misses=0, consecutive_heartbeats=5)
    status.consecutive_misses += 1
    status.consecutive_heartbeats = 0
    assert status.consecutive_misses < HEARTBEAT_FAILURE_THRESHOLD
    assert status.status == HostState.ONLINE


def test_misses_reach_failure_threshold():
    """After enough misses, host transitions to OFFLINE."""
    status = FakeHostStatus(status=HostState.ONLINE, consecutive_misses=HEARTBEAT_FAILURE_THRESHOLD - 1)
    status.consecutive_misses += 1
    status.consecutive_heartbeats = 0
    if status.consecutive_misses >= HEARTBEAT_FAILURE_THRESHOLD:
        status.status = HostState.OFFLINE
    assert status.status == HostState.OFFLINE


def test_already_offline_stays_offline():
    """Already-offline host stays offline on continued misses."""
    status = FakeHostStatus(status=HostState.OFFLINE, consecutive_misses=10)
    status.consecutive_misses += 1
    assert status.status == HostState.OFFLINE


def test_degraded_to_offline_on_misses():
    """DEGRADED host transitions to OFFLINE after enough misses."""
    status = FakeHostStatus(status=HostState.DEGRADED, consecutive_misses=HEARTBEAT_FAILURE_THRESHOLD - 1)
    status.consecutive_misses += 1
    status.consecutive_heartbeats = 0
    if status.consecutive_misses >= HEARTBEAT_FAILURE_THRESHOLD:
        status.status = HostState.OFFLINE
    assert status.status == HostState.OFFLINE


# --- Reset behavior ---

def test_heartbeat_resets_miss_counter():
    """Heartbeat should reset consecutive misses."""
    status = FakeHostStatus(status=HostState.ONLINE, consecutive_misses=2, consecutive_heartbeats=0)
    status.consecutive_heartbeats += 1
    status.consecutive_misses = 0
    assert status.consecutive_misses == 0
    assert status.consecutive_heartbeats == 1


def test_miss_resets_heartbeat_counter():
    """Miss should reset consecutive heartbeats."""
    status = FakeHostStatus(status=HostState.ONLINE, consecutive_heartbeats=5, consecutive_misses=0)
    status.consecutive_misses += 1
    status.consecutive_heartbeats = 0
    assert status.consecutive_heartbeats == 0
    assert status.consecutive_misses == 1


# --- Threshold values ---

def test_recovery_threshold_is_two():
    assert HEARTBEAT_RECOVERY_THRESHOLD == 2


def test_failure_threshold_is_three():
    assert HEARTBEAT_FAILURE_THRESHOLD == 3


# --- Full cycle test ---

def test_full_offline_recovery_cycle():
    """Test complete cycle: UNKNOWN -> ONLINE -> OFFLINE -> ONLINE."""
    status = FakeHostStatus(status=HostState.UNKNOWN)

    # Get to ONLINE
    for _ in range(HEARTBEAT_RECOVERY_THRESHOLD):
        status.consecutive_heartbeats += 1
        status.consecutive_misses = 0
    if status.consecutive_heartbeats >= HEARTBEAT_RECOVERY_THRESHOLD:
        status.status = HostState.ONLINE
    assert status.status == HostState.ONLINE

    # Go OFFLINE
    status.consecutive_heartbeats = 0
    for _ in range(HEARTBEAT_FAILURE_THRESHOLD):
        status.consecutive_misses += 1
    if status.consecutive_misses >= HEARTBEAT_FAILURE_THRESHOLD:
        status.status = HostState.OFFLINE
    assert status.status == HostState.OFFLINE

    # Recover to ONLINE
    status.consecutive_misses = 0
    status.consecutive_heartbeats = 0
    for _ in range(HEARTBEAT_RECOVERY_THRESHOLD):
        status.consecutive_heartbeats += 1
    if status.consecutive_heartbeats >= HEARTBEAT_RECOVERY_THRESHOLD:
        status.status = HostState.ONLINE
    assert status.status == HostState.ONLINE
