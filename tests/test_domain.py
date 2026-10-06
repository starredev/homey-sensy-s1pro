"""Zones, polygons, trackers, the state router and the firmware profile."""

from __future__ import annotations

import re

import pytest

from lib.errors import ValidationError
from lib.sensor.air_quality import AirQuality
from lib.sensor.bindings import NumberSettingBinding, SwitchSettingBinding, TargetFeed
from lib.sensor.polygon import Polygon
from lib.sensor.profile import S1ProProfile
from lib.sensor.state_router import StateRouter
from lib.sensor.target_tracker import TargetTracker
from lib.sensor.value_tracker import ValueTracker
from lib.sensor.zone import Zone
from lib.sensor.zone_repository import ZoneRepository
from tests.fakes import FakePort, square


def _feed(name: str) -> TargetFeed:
    for feed in S1ProProfile.TARGET_FEEDS:
        if feed.name == name:
            return feed

    raise AssertionError(name)


class TestZone:
    def test_flyweights(self) -> None:
        assert Zone.of("2") is Zone.of(2)
        assert Zone.of("exclusion") is Zone.EXCLUSION
        assert Zone.ALL == (Zone.ONE, Zone.TWO, Zone.THREE, Zone.EXCLUSION)

    def test_entity_ids(self) -> None:
        assert Zone.ONE.entity("presence") == "zone_1_presence"
        assert Zone.EXCLUSION.entity("p1_x") == "exclusion_zone_p1_x"
        assert str(Zone.TWO) == "2"
        assert repr(Zone.TWO) == "Zone('2')"

    def test_rejects_unknown_zones(self) -> None:
        with pytest.raises(ValidationError):
            Zone.of(4)

        with pytest.raises(ValidationError):
            Zone.detection("exclusion")

        assert Zone.detection("3") is Zone.THREE


class TestPolygon:
    def test_parses_and_normalises(self) -> None:
        polygon = Polygon.parse([[-100.4, 100.6], ["100", 100], [100, 300], [5000, -5000]])

        assert polygon.points == ((-100, 101), (100, 100), (100, 300), (1800, -1800))
        assert polygon.size == 4
        assert polygon.to_json() == [[-100, 101], [100, 100], [100, 300], [1800, -1800]]

    def test_empty(self) -> None:
        assert Polygon.parse([]) is Polygon.EMPTY
        assert Polygon.EMPTY.is_empty

    @pytest.mark.parametrize(
        "value",
        [
            "nope",
            [[0, 0], [1, 1]],
            [[0, 0]] * 9,
            [[0, 0], [1, 1], "x"],
            [[0, 0], [1, 1], [2]],
            [[0, 0], [1, 1], [2, "abc"]],
            [[0, 0], [1, 1], [2, float("nan")]],
            [[0, 0], [1, 1], [2, None]],
            [[0, 0], [1, 1], [2, True]],
        ],
    )
    def test_rejects_invalid_input(self, value: object) -> None:
        with pytest.raises(ValidationError):
            Polygon.parse(value)

    def test_equality(self) -> None:
        a = Polygon.parse([list(point) for point in square()])
        b = Polygon.parse([list(point) for point in square()])

        assert a == b
        assert hash(a) == hash(b)
        assert a != Polygon.EMPTY
        assert a != "polygon"
        assert repr(Polygon.EMPTY) == "Polygon([])"


class TestValueTracker:
    def test_first_value_after_reset_is_initial(self) -> None:
        tracker = ValueTracker()

        first = tracker.update("a", True)
        assert first.initial
        assert not first.changed

        second = tracker.update("a", False)
        assert second.changed
        assert second.previous is True

        tracker.reset()
        again = tracker.update("a", True)
        assert again.initial
        assert not again.changed
        assert tracker.get("a", False) is True
        assert tracker.get("missing", 3) == 3


class TestTargetTracker:
    def test_official_feed_completes_on_y(self) -> None:
        tracker = TargetTracker()
        feed = _feed("official")

        assert not tracker.update(0, "x", 120.4, feed)
        assert tracker.update(0, "y", 250.6, feed)
        assert tracker.positions == [(120, 251), None, None]

        assert not tracker.update(0, "x", 120.4, feed)
        assert not tracker.update(0, "y", 250.6, feed)

        tracker.update(0, "x", 0, feed)
        assert tracker.update(0, "y", 0, feed)
        assert tracker.positions[0] is None

    def test_homey_edition_feed_updates_on_every_axis(self) -> None:
        tracker = TargetTracker()
        feed = _feed("homey-edition")

        tracker.update(1, "x", 10, feed)
        assert tracker.update(1, "y", 20, feed)
        assert tracker.update(1, "x", 30, feed)
        assert tracker.update(1, "x", -9999, feed)
        assert tracker.positions[1] is None

    def test_ignores_unknown_slots_and_resets(self) -> None:
        tracker = TargetTracker()
        feed = _feed("homey-edition")

        assert not tracker.update(3, "x", 1, feed)
        assert not tracker.update(-1, "x", 1, feed)

        tracker.update(0, "x", 1, feed)
        tracker.update(0, "y", 1, feed)
        tracker.reset()

        assert tracker.positions == [None, None, None]


class TestStateRouter:
    def test_exact_routes_win_over_patterns(self) -> None:
        router = StateRouter()
        seen: list[tuple[str, object, tuple[str, ...]]] = []

        router.on("zone_1_presence", lambda value, groups: seen.append(("exact", value, groups)))
        router.on(re.compile(r"zone_(\d)_presence"), lambda value, groups: seen.append(("pattern", value, groups)))
        router.on(["a", "b"], lambda value, groups: seen.append(("many", value, groups)))

        assert router.dispatch("zone_1_presence", True)
        assert router.dispatch("zone_2_presence", False)
        assert router.dispatch("b", 1)
        assert not router.dispatch("zone_2_presence_delay", 1)
        assert not router.dispatch("unknown", 1)

        assert seen == [
            ("exact", True, ()),
            ("pattern", False, ("2",)),
            ("many", 1, ()),
        ]


class TestBindings:
    def test_number_setting(self) -> None:
        port = FakePort()
        binding = NumberSettingBinding("detection_range", "detection_range")

        assert binding.read(port) is None

        port.values["detection_range"] = 600.04
        assert binding.read(port) == 600.0

        binding.write(port, "450")
        assert port.commands == [("number", "detection_range", 450.0)]

    def test_switch_setting(self) -> None:
        port = FakePort()
        binding = SwitchSettingBinding("single_target", "radar___single_target")

        port.values["radar___single_target"] = 1.0
        assert binding.read(port) is True

        binding.write(port, False)
        assert port.commands == [("switch", "radar___single_target", False)]

    def test_profile_settings_cover_every_zone(self) -> None:
        keys = [binding.key for binding in S1ProProfile.SETTINGS]

        assert "zone3_movement_threshold" in keys
        assert "gate_radius" in keys
        assert len(keys) == len(set(keys)) == 18


class TestZoneRepository:
    def test_reads_an_outline_once_complete(self) -> None:
        port = FakePort()
        repository = ZoneRepository(port)

        assert repository.read(Zone.ONE) is None

        port.values["zone_1_points_count"] = 4
        assert repository.read(Zone.ONE) is None
        assert not repository.is_configured(Zone.ONE)

        port.report_zone(Zone.ONE, square())

        outline = repository.read(Zone.ONE)
        assert outline is not None
        assert outline.points == tuple(square())
        assert repository.is_configured(Zone.ONE)

    def test_too_few_points_mean_empty(self) -> None:
        port = FakePort()
        repository = ZoneRepository(port)

        port.values["zone_2_points_count"] = 2

        assert repository.read(Zone.TWO) is Polygon.EMPTY
        assert not repository.is_configured(Zone.TWO)

    def test_writes_outline_with_the_zone_disabled_meanwhile(self) -> None:
        port = FakePort()
        repository = ZoneRepository(port)

        repository.write(Zone.EXCLUSION, Polygon.parse([[0, 0], [10, 0], [10, 10]]))

        assert port.commands[0] == ("number", "exclusion_zone_points_count", 0)
        assert port.commands[-1] == ("number", "exclusion_zone_points_count", 3)
        assert len(port.commands) == 8

    def test_clearing_only_resets_the_count(self) -> None:
        port = FakePort()
        repository = ZoneRepository(port)

        repository.write(Zone.ONE, Polygon.EMPTY)

        assert port.commands == [("number", "zone_1_points_count", 0)]

    def test_options_are_bounded(self) -> None:
        port = FakePort()
        repository = ZoneRepository(port)

        repository.write_options(Zone.TWO, presence_delay=99999, movement_threshold="-5")
        repository.write_options(Zone.TWO)

        assert port.commands == [
            ("number", "zone_2_presence_delay", 3600),
            ("number", "zone_2_movement_threshold", 0),
        ]

        options = repository.read_options(Zone.TWO)
        assert options.presence_delay == 3600
        assert options.movement_threshold == 0


class TestAirQuality:
    def test_parses_firmware_text_in_order(self) -> None:
        assert AirQuality.parse("Lightly polluted") is AirQuality.LIGHTLY_POLLUTED
        assert AirQuality.parse("error") is None
        assert [level.rank for level in AirQuality.LEVELS] == list(range(7))
        assert str(AirQuality.GOOD) == "Good"
        assert repr(AirQuality.GOOD) == "AirQuality('Good')"

    def test_comparison(self) -> None:
        assert AirQuality.HEAVILY_POLLUTED.at_least_as_bad_as(AirQuality.LIGHTLY_POLLUTED)
        assert AirQuality.GOOD.at_least_as_bad_as(AirQuality.GOOD)
        assert not AirQuality.EXCELLENT.at_least_as_bad_as(AirQuality.GOOD)

    def test_rejects_unknown_levels(self) -> None:
        with pytest.raises(ValidationError):
            AirQuality.of("Smoky")
