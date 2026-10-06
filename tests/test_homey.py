"""Homey adapters: brand profile, capabilities, settings, flows, realtime and the web API."""

from __future__ import annotations

from typing import Any

import pytest
from aioesphomeapi import (
    BinarySensorInfo,
    EntityCategory,
    EntityInfo,
    NumberInfo,
    SensorInfo,
    SwitchInfo,
    TextSensorInfo,
)
from homey_esphomedriver.entities.mapping import DeviceEntityMapper
from homey_esphomedriver.esphome_types import HomeyEspHomeDeviceOption

from lib.errors import NotConnectedError, NotFoundError, ValidationError
from lib.homey.brand_profile import SENSY_BRAND_PROFILE
from lib.homey.capability_store import CapabilityStore
from lib.homey.flow_cards import Cards, FlowCards, TriggerInvocation, dropdown_argument
from lib.homey.presenter import SensorPresenter
from lib.homey.realtime_hub import Channels, RealtimeHub
from lib.homey.sensy_api import SensyApi
from lib.homey.settings_mirror import SettingsMirror
from lib.homey.zone_capabilities import ZoneCapabilities
from lib.sensor.air_quality import AirQuality
from lib.sensor.events import (
    AirQualityChanged,
    PeopleCountChanged,
    PresenceChanged,
    SensorEvent,
    ZoneMovementChanged,
    ZonePresenceChanged,
)
from lib.sensor.polygon import Polygon
from lib.sensor.sensor import ZoneStatus
from lib.sensor.zone import Zone
from tests.fakes import (
    FakeCapabilityHost,
    FakeFlow,
    FakeRealtimeApi,
    FakeTimers,
    FlowTestDevice,
    RecordingLogger,
    SensorRig,
    build,
    make_sensor,
    make_view,
    square,
)

S1_PRO_ENTITIES: list[EntityInfo] = [
    build(BinarySensorInfo, key=1, object_id="any_presence", device_class="presence"),
    build(BinarySensorInfo, key=2, object_id="any_movement", device_class="motion"),
    build(BinarySensorInfo, key=3, object_id="zone_1_presence", device_class="presence"),
    build(SensorInfo, key=4, object_id="all_targets_count"),
    build(SensorInfo, key=5, object_id="bme688_temperature", device_class="temperature", unit_of_measurement="°C"),
    build(SensorInfo, key=6, object_id="scd40_temperature", device_class="temperature", unit_of_measurement="°C"),
    build(SensorInfo, key=7, object_id="bme688_iaq", unit_of_measurement="IAQ"),
    build(
        SensorInfo,
        key=15,
        object_id="bme688_voc_equivalent",
        device_class="volatile_organic_compounds_parts",
        unit_of_measurement="ppm",
    ),
    build(TextSensorInfo, key=16, object_id="bme688_iaq_classification"),
    build(TextSensorInfo, key=17, object_id="bme688_iaq_accuracy"),
    build(NumberInfo, key=18, object_id="radar_gate_radius", max_value=300),
    build(SensorInfo, key=8, object_id="target_1_x", unit_of_measurement="cm"),
    build(NumberInfo, key=9, object_id="zone_1_p1_x", unit_of_measurement="cm", max_value=1800),
    build(NumberInfo, key=10, object_id="detection_range", max_value=1800),
    build(SwitchInfo, key=11, object_id="radar___single_target", entity_category=EntityCategory.CONFIG),
    build(SwitchInfo, key=12, object_id="radar___flip_y_axis", entity_category=EntityCategory.CONFIG),
    build(TextSensorInfo, key=13, object_id="esp32___ssid", entity_category=EntityCategory.DIAGNOSTIC),
    build(SensorInfo, key=14, object_id="esp32___factory_reset", entity_category=EntityCategory.CONFIG),
]


def _mapped(*, diagnostics: bool = False, configuration: bool = False) -> HomeyEspHomeDeviceOption:
    device = DeviceEntityMapper.empty_option()

    DeviceEntityMapper.map_device(
        S1_PRO_ENTITIES,
        device,
        profile=SENSY_BRAND_PROFILE,
        diagnostics=diagnostics,
        configuration=configuration,
    )

    return device


@pytest.fixture
def rig() -> SensorRig:
    rig = make_sensor()
    rig.port.connect()

    return rig


class TestBrandProfile:
    def test_maps_only_the_primary_entities(self) -> None:
        device = _mapped()

        assert device["capabilities"] == [
            "alarm_presence",
            "alarm_motion",
            "sensy_people",
            "measure_temperature",
            "sensy_iaq",
            "measure_tvoc",
            "sensy_air_quality",
            "sensy_iaq_accuracy",
            "button.refresh",
        ]
        assert device["capabilitiesOptions"]["sensy_people"]["key"] == 4
        assert device.get("class") == "sensor"

    def test_configuration_entities_on_request_without_settings_or_dangerous_ones(self) -> None:
        device = _mapped(diagnostics=True, configuration=True)
        capabilities = device["capabilities"]

        assert "onoff" in capabilities or "onoff.radar___flip_y_axis" in capabilities
        assert "esphome_string.esp32___ssid" in capabilities
        assert not any("single_target" in capability for capability in capabilities)
        assert not any("factory_reset" in capability for capability in capabilities)
        assert device.get("class") == "sensor"

    def test_accepts_only_the_s1_pro(self) -> None:
        assert SENSY_BRAND_PROFILE.accepts_project("Sensy-One.S1 Pro Multi Sense")
        assert not SENSY_BRAND_PROFILE.accepts_project("Other.Device")
        assert SENSY_BRAND_PROFILE.client_info == "Homey Sensy S1 Pro"

    def test_keeps_markers_that_still_have_sub_capabilities(self) -> None:
        device: HomeyEspHomeDeviceOption = {
            "name": "",
            "data": {},
            "store": {},
            "settings": {},
            "capabilities": ["esphome_number", "esphome_number.foo", "esphome_string", "esphome_boolean"],
            "capabilitiesOptions": {
                "esphome_number": {"uiComponent": None},
                "esphome_number.foo": {"key": 1},
                "esphome_string": {"uiComponent": None},
                "esphome_boolean": {"key": 2},
            },
        }

        SENSY_BRAND_PROFILE.after_map([], device)

        assert device["capabilities"] == ["esphome_number", "esphome_number.foo", "esphome_boolean"]


class TestCapabilityStore:
    async def test_skips_missing_and_unchanged_capabilities(self) -> None:
        host = FakeCapabilityHost({"measure_co2": 500})
        store = CapabilityStore(host, RecordingLogger())

        await store.set("measure_co2", 500)
        await store.set("measure_co2", 600)
        await store.set("missing", 1)

        assert host.writes == [("measure_co2", 600)]
        assert store.get("measure_co2") == 600
        assert store.get("missing") is None
        assert store.has("measure_co2")

    async def test_logs_failed_writes(self) -> None:
        host = FakeCapabilityHost({"measure_co2": 500})
        logger = RecordingLogger()
        store = CapabilityStore(host, logger)

        host.fail_writes = True
        await store.set("measure_co2", 600)

        assert len(logger.errors) == 1

    async def test_add_and_remove(self) -> None:
        host = FakeCapabilityHost()
        store = CapabilityStore(host, RecordingLogger())

        await store.add("sensy_zone_presence.zone1", {"title": {"en": "Zone 1"}})
        await store.add("sensy_zone_presence.zone1", {"title": {"en": "Other"}})
        assert host.options["sensy_zone_presence.zone1"] == {"title": {"en": "Zone 1"}}

        await store.remove("sensy_zone_presence.zone1")
        await store.remove("sensy_zone_presence.zone1")
        assert not store.has("sensy_zone_presence.zone1")


class TestZoneCapabilities:
    async def test_only_drawn_zones_get_capabilities(self) -> None:
        host = FakeCapabilityHost()
        zones = ZoneCapabilities(CapabilityStore(host, RecordingLogger()))
        outlines: dict[Zone, Polygon | None] = {
            Zone.ONE: Polygon.parse([list(point) for point in square()]),
            Zone.TWO: Polygon.EMPTY,
            Zone.THREE: None,
        }

        def outline_of(zone: Zone) -> Polygon | None:
            return outlines[zone]

        def status_of(zone: Zone) -> ZoneStatus:
            del zone

            return ZoneStatus(presence=True, movement=False, people=2)

        host.values["sensy_zone_presence.zone2"] = False
        await zones.reconcile(outline_of, status_of)

        assert host.values == {
            "sensy_zone_presence.zone1": True,
            "sensy_zone_movement.zone1": False,
            "sensy_zone_people.zone1": 2,
        }
        assert host.options["sensy_zone_people.zone1"] == {
            "title": {"en": "People in zone 1", "nl": "Personen in zone 1"}
        }


class TestSettingsMirror:
    async def test_pull_copies_changed_values(self, rig: SensorRig) -> None:
        host = FakeCapabilityHost()
        mirror = SettingsMirror(host, rig.sensor)

        host.settings = {"detection_range": 600.0}
        rig.port.report("detection_range", 600)
        rig.port.report("any_presence_delay", 30)

        await mirror.pull()
        assert host.settings == {"detection_range": 600.0, "any_presence_delay": 30.0}

        await mirror.pull()

    def test_push_writes_sensor_settings_only(self, rig: SensorRig) -> None:
        mirror = SettingsMirror(FakeCapabilityHost(), rig.sensor)

        mirror.push({"detection_range": 450, "device_class": "auto"}, ("detection_range", "device_class"))
        mirror.push({"device_class": "auto"}, ("device_class",))

        assert rig.port.commands == [("number", "detection_range", 450.0)]

    def test_push_while_offline_raises(self, rig: SensorRig) -> None:
        mirror = SettingsMirror(FakeCapabilityHost(), rig.sensor)

        rig.port.disconnect()

        with pytest.raises(NotConnectedError):
            mirror.push({"single_target": True}, ("single_target",))


class TestFlowCards:
    @pytest.mark.parametrize(
        ("event", "expected"),
        [
            (PresenceChanged(present=True, people=2), TriggerInvocation(Cards.ROOM_OCCUPIED, {"people": 2})),
            (PresenceChanged(present=False, people=0), TriggerInvocation(Cards.ROOM_EMPTY)),
            (
                PeopleCountChanged(people=2, previous=1),
                TriggerInvocation(Cards.PEOPLE_CHANGED, {"people": 2, "previous": 1}),
            ),
            (
                ZonePresenceChanged(zone=Zone.TWO, present=True, people=1),
                TriggerInvocation(Cards.ZONE_ENTERED, {"people": 1}, "2"),
            ),
            (ZonePresenceChanged(zone=Zone.TWO, present=False, people=0), TriggerInvocation(Cards.ZONE_LEFT, zone="2")),
            (ZoneMovementChanged(zone=Zone.ONE, moving=True), TriggerInvocation(Cards.ZONE_MOVEMENT_STARTED, zone="1")),
            (
                ZoneMovementChanged(zone=Zone.ONE, moving=False),
                TriggerInvocation(Cards.ZONE_MOVEMENT_STOPPED, zone="1"),
            ),
            (
                AirQualityChanged(quality=AirQuality.GOOD, previous=AirQuality.EXCELLENT),
                TriggerInvocation(Cards.AIR_QUALITY_CHANGED, {"air_quality": "Good", "previous": "Excellent"}),
            ),
            (SensorEvent(), None),
        ],
    )
    def test_translate(self, event: SensorEvent, expected: TriggerInvocation | None) -> None:
        assert FlowCards.translate(event) == expected

    async def test_dispatch_triggers_cards(self, rig: SensorRig) -> None:
        flow = FakeFlow()
        cards = FlowCards(flow, RecordingLogger()).register()
        device = FlowTestDevice(rig.sensor)

        await cards.dispatch(device, PresenceChanged(present=True, people=1))
        await cards.dispatch(device, ZoneMovementChanged(zone=Zone.ONE, moving=True))
        await cards.dispatch(device, SensorEvent())

        assert flow.cards[Cards.ROOM_OCCUPIED].triggers == [(device, {"people": 1}, {})]
        assert flow.cards[Cards.ZONE_MOVEMENT_STARTED].triggers == [(device, {}, {"zone": "1"})]

    async def test_dispatch_logs_failures(self, rig: SensorRig) -> None:
        flow = FakeFlow()
        logger = RecordingLogger()
        cards = FlowCards(flow, logger).register()

        flow.cards[Cards.ROOM_EMPTY].fail = True
        await cards.dispatch(FlowTestDevice(rig.sensor), PresenceChanged(present=False, people=0))

        assert len(logger.errors) == 1

    async def test_dispatch_without_registration_is_a_no_op(self, rig: SensorRig) -> None:
        cards = FlowCards(FakeFlow(), RecordingLogger())

        await cards.dispatch(FlowTestDevice(rig.sensor), PresenceChanged(present=False, people=0))

    async def test_zone_triggers_filter_on_the_selected_zone(self) -> None:
        flow = FakeFlow()
        FlowCards(flow, RecordingLogger()).register()
        card = flow.cards[Cards.ZONE_ENTERED]

        assert await card.run({"zone": "2"}, zone="2")
        assert await card.run({"zone": {"id": "2", "name": "Zone 2"}}, zone="2")
        assert not await card.run({"zone": "1"}, zone="2")

    async def test_conditions(self, rig: SensorRig) -> None:
        flow = FakeFlow()
        FlowCards(flow, RecordingLogger()).register()
        device = FlowTestDevice(rig.sensor)

        rig.port.report("any_presence", True)
        rig.port.report("all_targets_count", 2)
        rig.port.report_zone(Zone.ONE, square())
        rig.port.report("zone_1_presence", True)
        rig.port.report("zone_1_movement", True)

        assert await flow.cards[Cards.IS_PRESENT].run({"device": device})
        assert await flow.cards[Cards.ZONE_OCCUPIED].run({"device": device, "zone": "1"})
        assert await flow.cards[Cards.ZONE_MOVING].run({"device": device, "zone": "1"})
        assert not await flow.cards[Cards.ZONE_MOVING].run({"device": device, "zone": "2"})
        assert await flow.cards[Cards.PEOPLE_ABOVE].run({"device": device, "count": 1})
        assert not await flow.cards[Cards.PEOPLE_ABOVE].run({"device": device, "count": 2})

    async def test_air_quality_condition(self, rig: SensorRig) -> None:
        flow = FakeFlow()
        FlowCards(flow, RecordingLogger()).register()
        device = FlowTestDevice(rig.sensor)
        card = flow.cards[Cards.AIR_QUALITY_AT_LEAST]

        assert not await card.run({"device": device, "level": "Good"})

        rig.port.report("bme688_iaq_classification", "Moderately polluted")

        assert await card.run({"device": device, "level": "Lightly polluted"})
        assert await card.run({"device": device, "level": {"id": "Moderately polluted"}})
        assert not await card.run({"device": device, "level": "Heavily polluted"})

        with pytest.raises(ValidationError):
            await card.run({"device": device, "level": "Smoky"})

    async def test_actions(self, rig: SensorRig) -> None:
        flow = FakeFlow()
        FlowCards(flow, RecordingLogger()).register()
        device = FlowTestDevice(rig.sensor)

        await flow.cards[Cards.SET_ZONE_DELAY].run({"device": device, "zone": "3", "seconds": 45})
        await flow.cards[Cards.BEEP].run({"device": device, "duration": 1})

        assert rig.port.commands[0] == ("number", "zone_3_presence_delay", 45)
        assert rig.sleeps == [1]

        with pytest.raises(ValidationError):
            await flow.cards[Cards.SET_ZONE_DELAY].run({"device": device, "zone": "exclusion", "seconds": 1})

    def test_zone_argument(self) -> None:
        assert dropdown_argument("1") == "1"
        assert dropdown_argument({"id": "2"}) == "2"


class TestPresenter:
    def test_live_and_snapshot(self, rig: SensorRig) -> None:
        rig.port.report("target_1_x", 100)
        rig.port.report("target_1_y", 200)
        rig.port.report("any_presence", True)
        rig.port.report_zone(Zone.ONE, square())
        rig.port.report("zone_1_presence_delay", 30)

        view = make_view(rig.sensor)
        live = SensorPresenter.live(view)

        assert live["targets"] == [[100, 200], None, None]
        assert live["presence"] is True
        assert live["zones"][0] == {"zone": 1, "presence": False, "movement": False, "people": 0}

        snapshot = SensorPresenter.snapshot(view)

        assert snapshot["name"] == "Living room"
        assert snapshot["detectionRange"] == 600
        assert snapshot["zones"]["1"] == {
            "points": [[-100, 100], [100, 100], [100, 300], [-100, 300]],
            "presenceDelay": 30,
            "movementThreshold": 0,
        }
        assert snapshot["zones"]["exclusion"] == {"points": []}
        assert snapshot["env"] == {"temperature": 21.5, "humidity": None, "co2": 600, "iaq": None, "lux": None}
        assert SensorPresenter.summary(view) == {"id": "48f6ee2cd9f0", "name": "Living room", "connected": True}


class TestRealtimeHub:
    async def test_throttles_live_frames(self, rig: SensorRig) -> None:
        api = FakeRealtimeApi()
        timers = FakeTimers()
        hub = RealtimeHub(api=api, timers=timers, logger=RecordingLogger())
        view = make_view(rig.sensor)

        hub.live(view)
        hub.live(view)
        timers.tick(RealtimeHub.LIVE_INTERVAL_MS)
        hub.zones(view)
        hub.devices([view])
        await hub.drain()

        channels = [channel for channel, _ in api.published]

        assert channels == [Channels.LIVE, Channels.ZONES, Channels.DEVICES]
        assert api.published[2][1] == [{"id": "48f6ee2cd9f0", "name": "Living room", "connected": True}]

        hub.live(view)
        hub.dispose()
        timers.tick(1000)
        await hub.drain()
        assert len(api.published) == 3

    async def test_logs_failures(self, rig: SensorRig) -> None:
        api = FakeRealtimeApi()
        logger = RecordingLogger()
        hub = RealtimeHub(api=api, timers=FakeTimers(), logger=logger)

        api.fail = True
        hub.devices([make_view(rig.sensor)])
        await hub.drain()

        assert len(logger.errors) == 1


class TestSensyApi:
    def _api(self, rig: SensorRig) -> SensyApi:
        views = [make_view(rig.sensor), make_view(rig.sensor, "other", "Kitchen")]

        return SensyApi(lambda: views)

    def test_lists_and_snapshots(self, rig: SensorRig) -> None:
        api = self._api(rig)

        assert [device["name"] for device in api.list_devices()] == ["Living room", "Kitchen"]

        first = api.get_snapshot(None)
        assert first is not None
        assert first["id"] == "48f6ee2cd9f0"

        other = api.get_snapshot("other")
        assert other is not None
        assert other["name"] == "Kitchen"

        assert SensyApi(list).get_snapshot(None) is None

        with pytest.raises(NotFoundError):
            api.get_snapshot("missing")

    def test_set_zone(self, rig: SensorRig) -> None:
        api = self._api(rig)
        body: dict[str, Any] = {"points": [[0, 0], [100, 0], [100, 100]]}

        assert api.set_zone("other", "exclusion", body) == {
            "zone": "exclusion",
            "points": [[0, 0], [100, 0], [100, 100]],
        }
        assert api.set_zone("other", "2", None) == {"zone": "2", "points": []}

        with pytest.raises(ValidationError):
            api.set_zone("other", "2", [1, 2])

        with pytest.raises(ValidationError):
            api.set_zone("other", "9", body)

    def test_set_zone_options(self, rig: SensorRig) -> None:
        api = self._api(rig)

        assert api.set_zone_options("other", "1", {"presenceDelay": 20}) == {"zone": "1"}
        assert rig.port.commands == [("number", "zone_1_presence_delay", 20)]

        with pytest.raises(ValidationError):
            api.set_zone_options("other", "exclusion", {})
