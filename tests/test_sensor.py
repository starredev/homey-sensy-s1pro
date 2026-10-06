"""The S1 Pro domain model."""

from __future__ import annotations

import pytest

from lib.errors import NotConnectedError
from lib.sensor.air_quality import AirQuality
from lib.sensor.events import (
    AirQualityChanged,
    PeopleCountChanged,
    PresenceChanged,
    ZoneMovementChanged,
    ZonePresenceChanged,
)
from lib.sensor.polygon import Polygon
from lib.sensor.sensor import S1ProSensor, ZoneStatus
from lib.sensor.zone import Zone
from tests.fakes import SensorRig, make_sensor, square, square_polygon


@pytest.fixture
def rig() -> SensorRig:
    rig = make_sensor()
    rig.port.connect()

    return rig


class TestLifecycle:
    def test_connect_schedules_zone_and_setting_snapshots(self, rig: SensorRig) -> None:
        assert rig.observer.calls == ["connected"]

        rig.timers.tick(S1ProSensor.ZONE_SETTLE_MS)
        assert rig.observer.count("zones") == 1

        rig.timers.tick(S1ProSensor.SETTINGS_SETTLE_MS)
        assert rig.observer.count("settings") == 1

    def test_disconnect_cancels_pending_work_and_clears_targets(self, rig: SensorRig) -> None:
        rig.port.report("target_1_x", 100)
        rig.port.report("target_1_y", 200)
        assert rig.sensor.targets[0] == (100, 200)

        rig.port.disconnect()
        rig.timers.tick(5000)

        assert rig.observer.count("zones") == 0
        assert rig.observer.calls[-1] == "disconnected"
        assert rig.sensor.targets == [None, None, None]
        assert not rig.sensor.connected

    def test_stop_cancels_debouncers(self, rig: SensorRig) -> None:
        rig.sensor.stop()
        rig.timers.tick(5000)

        assert rig.observer.count("zones") == 0
        assert rig.observer.count("settings") == 0


class TestPresence:
    def test_room_events_only_on_real_changes(self, rig: SensorRig) -> None:
        rig.port.report("all_targets_count", 2.0)
        rig.port.report("any_presence", True)
        assert rig.observer.events == []

        rig.port.report("any_presence", False)
        rig.port.report("any_presence", True)
        rig.port.report("all_targets_count", 3.0)

        assert rig.observer.events == [
            PresenceChanged(present=False, people=2),
            PresenceChanged(present=True, people=2),
            PeopleCountChanged(people=3, previous=2),
        ]
        assert rig.sensor.present
        assert rig.sensor.people == 3

    def test_reconnect_does_not_fire_flows_for_resent_values(self, rig: SensorRig) -> None:
        rig.port.report("any_presence", True)
        rig.port.report("any_presence", False)

        rig.port.connect()
        rig.port.report("any_presence", True)

        assert len(rig.observer.events) == 1

    def test_live_on_tracked_entities(self, rig: SensorRig) -> None:
        rig.port.report("any_movement", True)
        rig.port.report("all_targets_count", 1)

        assert rig.observer.count("live") == 2
        assert rig.sensor.moving


class TestTargets:
    def test_live_only_when_a_target_moved(self, rig: SensorRig) -> None:
        rig.port.report("target_1_x", 100)
        rig.port.report("target_1_y", 200)
        rig.port.report("target_1_x", 100)
        rig.port.report("target_1_y", 200)

        assert rig.observer.count("live") == 1

    def test_homey_edition_feed(self, rig: SensorRig) -> None:
        rig.port.report("live_t2_x", 10)
        rig.port.report("live_t2_y", 20)

        assert rig.sensor.targets[1] == (10, 20)


class TestZones:
    def test_zone_flows_need_an_outline(self, rig: SensorRig) -> None:
        rig.port.report("zone_1_presence", False)
        rig.port.report("zone_1_presence", True)
        assert rig.observer.events == []
        assert not rig.sensor.is_zone_occupied(Zone.ONE)

        rig.port.report_zone(Zone.ONE, square())
        rig.port.report("zone_1_presence", False)
        rig.port.report("zone_1_target_count", 2)
        rig.port.report("zone_1_presence", True)
        rig.port.report("zone_1_movement", False)
        rig.port.report("zone_1_movement", True)

        assert rig.observer.events == [
            ZonePresenceChanged(zone=Zone.ONE, present=False, people=0),
            ZonePresenceChanged(zone=Zone.ONE, present=True, people=2),
            ZoneMovementChanged(zone=Zone.ONE, moving=True),
        ]
        assert rig.sensor.is_zone_occupied(Zone.ONE)
        assert rig.sensor.is_zone_moving(Zone.ONE)

    def test_someone_entering_is_at_least_one_person(self, rig: SensorRig) -> None:
        rig.port.report_zone(Zone.TWO, square())
        rig.port.report("zone_2_presence", False)
        rig.port.report("zone_2_presence", True)

        assert rig.observer.events[-1] == ZonePresenceChanged(zone=Zone.TWO, present=True, people=1)

    def test_zone_status(self, rig: SensorRig) -> None:
        rig.port.report("zone_3_target_count", 1.6)

        assert rig.sensor.zone_status(Zone.THREE) == ZoneStatus(presence=False, movement=False, people=2)
        assert not rig.sensor.is_zone_moving(Zone.THREE)

    def test_geometry_changes_are_debounced(self, rig: SensorRig) -> None:
        rig.timers.tick(5000)
        rig.port.report_zone(Zone.ONE, square())
        rig.timers.tick(S1ProSensor.ZONE_SETTLE_MS)

        assert rig.observer.count("zones") == 2

    def test_outline_and_options(self, rig: SensorRig) -> None:
        rig.sensor.set_zone_outline(Zone.ONE, square_polygon())
        rig.sensor.set_zone_options(Zone.ONE, presence_delay=30)

        assert rig.sensor.zone_outline(Zone.ONE) == square_polygon()
        assert rig.sensor.zone_options(Zone.ONE).presence_delay == 30
        assert rig.sensor.zone_outline(Zone.TWO) is None

        rig.sensor.set_zone_outline(Zone.ONE, Polygon.EMPTY)
        assert rig.sensor.zone_outline(Zone.ONE) is Polygon.EMPTY


class TestSettings:
    def test_setting_entities_are_debounced(self, rig: SensorRig) -> None:
        rig.timers.tick(5000)
        rig.port.report("detection_range", 500)
        rig.port.report("radar___single_target", True)
        rig.timers.tick(S1ProSensor.SETTINGS_SETTLE_MS)

        assert rig.observer.count("settings") == 2
        assert rig.sensor.read_settings() == {"detection_range": 500.0, "single_target": True}
        assert rig.sensor.detection_range == 500

    def test_detection_range_fallback(self, rig: SensorRig) -> None:
        assert rig.sensor.detection_range == 600

    def test_apply_settings_ignores_unknown_keys(self, rig: SensorRig) -> None:
        written = rig.sensor.apply_settings([("detection_range", 450), ("unknown", 1), ("single_target", True)])

        assert written == ["detection_range", "single_target"]
        assert rig.port.commands == [
            ("number", "detection_range", 450.0),
            ("switch", "radar___single_target", True),
        ]


class TestBluetoothProxy:
    def test_reports_initial_state_and_changes(self, rig: SensorRig) -> None:
        rig.port.report("ble___proxy", False)
        rig.port.report("ble___proxy", False)
        rig.port.report("ble___proxy", True)

        assert rig.observer.proxy == [False, True]


class TestAirQuality:
    def test_changes_raise_events_but_not_the_first_report(self, rig: SensorRig) -> None:
        assert rig.sensor.air_quality is None

        rig.port.report("bme688_iaq_classification", "Excellent")
        rig.port.report("bme688_iaq_classification", "Excellent")
        rig.port.report("bme688_iaq_classification", "error")
        rig.port.report("bme688_iaq_classification", "Good")

        assert rig.observer.events == [AirQualityChanged(quality=AirQuality.GOOD, previous=AirQuality.EXCELLENT)]
        assert rig.sensor.air_quality is AirQuality.GOOD

    def test_reconnect_does_not_fire(self, rig: SensorRig) -> None:
        rig.port.report("bme688_iaq_classification", "Good")
        rig.port.connect()
        rig.port.report("bme688_iaq_classification", "Lightly polluted")

        assert rig.observer.events == []

    def test_tracking_settings(self, rig: SensorRig) -> None:
        rig.port.report("radar_gate_radius", 100)
        rig.port.report("ltr390_lux_offset", -2.5)

        assert rig.sensor.read_settings() == {"gate_radius": 100.0, "lux_offset": -2.5}


class TestBeep:
    async def test_beeps_for_a_clamped_duration(self, rig: SensorRig) -> None:
        await rig.sensor.beep(10)
        await rig.sensor.beep("abc")
        await rig.sensor.beep(0)

        assert rig.sleeps == [5, 0.3, 0.3]
        assert rig.port.commands[:2] == [
            ("switch", "mlt8530___buzzer", True),
            ("switch", "mlt8530___buzzer", False),
        ]

    async def test_offline_beep_raises(self, rig: SensorRig) -> None:
        rig.port.disconnect()

        with pytest.raises(NotConnectedError):
            await rig.sensor.beep(1)
