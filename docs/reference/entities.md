# Sensor entities

The S1 Pro on the official firmware v1.2.21 reports these 151 ESPHome entities. The table shows what the app does with
each of them. Object ids are as `aioesphomeapi` reports them; for names with non-ASCII characters they can differ
from other ESPHome clients (`SCD40 CO₂ Concentration` is `scd40_co__concentration`).

*Category* is the ESPHome entity category: entities without one are primary entities, *config* and *diagnostic*
entities are hidden by default in most ESPHome integrations.

## Presence and people

| Entity | Type | Category | In the app |
|---|---|---|---|
| `all_targets_count` | Sensor | — | Capability `sensy_people` · flows, widget |
| `any_movement` | BinarySensor | — | Capability `alarm_motion` · flows, widget |
| `any_movement_threshold` | Number | — | Setting `any_movement_threshold` |
| `any_presence` | BinarySensor | — | Capability `alarm_presence` · flows, widget |
| `any_presence_delay` | Number | — | Setting `any_presence_delay` |

## Zones

| Entity | Type | Category | In the app |
|---|---|---|---|
| `exclusion_zone_p1_x` | Number | — | Zone outline · zone editor, widget |
| `exclusion_zone_p1_y` | Number | — | Zone outline · zone editor, widget |
| `exclusion_zone_p2_x` | Number | — | Zone outline · zone editor, widget |
| `exclusion_zone_p2_y` | Number | — | Zone outline · zone editor, widget |
| `exclusion_zone_p3_x` | Number | — | Zone outline · zone editor, widget |
| `exclusion_zone_p3_y` | Number | — | Zone outline · zone editor, widget |
| `exclusion_zone_p4_x` | Number | — | Zone outline · zone editor, widget |
| `exclusion_zone_p4_y` | Number | — | Zone outline · zone editor, widget |
| `exclusion_zone_p5_x` | Number | — | Zone outline · zone editor, widget |
| `exclusion_zone_p5_y` | Number | — | Zone outline · zone editor, widget |
| `exclusion_zone_p6_x` | Number | — | Zone outline · zone editor, widget |
| `exclusion_zone_p6_y` | Number | — | Zone outline · zone editor, widget |
| `exclusion_zone_p7_x` | Number | — | Zone outline · zone editor, widget |
| `exclusion_zone_p7_y` | Number | — | Zone outline · zone editor, widget |
| `exclusion_zone_p8_x` | Number | — | Zone outline · zone editor, widget |
| `exclusion_zone_p8_y` | Number | — | Zone outline · zone editor, widget |
| `exclusion_zone_points_count` | Number | — | Zone outline · zone editor, widget |
| `zone_1_movement` | BinarySensor | — | Capability `sensy_zone_movement.zone1` (drawn zones only) · zone flows, widget |
| `zone_1_movement_threshold` | Number | — | Setting `zone1_movement_threshold` |
| `zone_1_p1_x` | Number | — | Zone outline · zone editor, widget |
| `zone_1_p1_y` | Number | — | Zone outline · zone editor, widget |
| `zone_1_p2_x` | Number | — | Zone outline · zone editor, widget |
| `zone_1_p2_y` | Number | — | Zone outline · zone editor, widget |
| `zone_1_p3_x` | Number | — | Zone outline · zone editor, widget |
| `zone_1_p3_y` | Number | — | Zone outline · zone editor, widget |
| `zone_1_p4_x` | Number | — | Zone outline · zone editor, widget |
| `zone_1_p4_y` | Number | — | Zone outline · zone editor, widget |
| `zone_1_p5_x` | Number | — | Zone outline · zone editor, widget |
| `zone_1_p5_y` | Number | — | Zone outline · zone editor, widget |
| `zone_1_p6_x` | Number | — | Zone outline · zone editor, widget |
| `zone_1_p6_y` | Number | — | Zone outline · zone editor, widget |
| `zone_1_p7_x` | Number | — | Zone outline · zone editor, widget |
| `zone_1_p7_y` | Number | — | Zone outline · zone editor, widget |
| `zone_1_p8_x` | Number | — | Zone outline · zone editor, widget |
| `zone_1_p8_y` | Number | — | Zone outline · zone editor, widget |
| `zone_1_points_count` | Number | — | Zone outline · zone editor, widget |
| `zone_1_presence` | BinarySensor | — | Capability `sensy_zone_presence.zone1` (drawn zones only) · zone flows, widget |
| `zone_1_presence_delay` | Number | — | Setting `zone1_presence_delay` |
| `zone_1_target_count` | Sensor | — | Capability `sensy_zone_people.zone1` (drawn zones only) · zone flows, widget |
| `zone_2_movement` | BinarySensor | — | Capability `sensy_zone_movement.zone2` (drawn zones only) · zone flows, widget |
| `zone_2_movement_threshold` | Number | — | Setting `zone2_movement_threshold` |
| `zone_2_p1_x` | Number | — | Zone outline · zone editor, widget |
| `zone_2_p1_y` | Number | — | Zone outline · zone editor, widget |
| `zone_2_p2_x` | Number | — | Zone outline · zone editor, widget |
| `zone_2_p2_y` | Number | — | Zone outline · zone editor, widget |
| `zone_2_p3_x` | Number | — | Zone outline · zone editor, widget |
| `zone_2_p3_y` | Number | — | Zone outline · zone editor, widget |
| `zone_2_p4_x` | Number | — | Zone outline · zone editor, widget |
| `zone_2_p4_y` | Number | — | Zone outline · zone editor, widget |
| `zone_2_p5_x` | Number | — | Zone outline · zone editor, widget |
| `zone_2_p5_y` | Number | — | Zone outline · zone editor, widget |
| `zone_2_p6_x` | Number | — | Zone outline · zone editor, widget |
| `zone_2_p6_y` | Number | — | Zone outline · zone editor, widget |
| `zone_2_p7_x` | Number | — | Zone outline · zone editor, widget |
| `zone_2_p7_y` | Number | — | Zone outline · zone editor, widget |
| `zone_2_p8_x` | Number | — | Zone outline · zone editor, widget |
| `zone_2_p8_y` | Number | — | Zone outline · zone editor, widget |
| `zone_2_points_count` | Number | — | Zone outline · zone editor, widget |
| `zone_2_presence` | BinarySensor | — | Capability `sensy_zone_presence.zone2` (drawn zones only) · zone flows, widget |
| `zone_2_presence_delay` | Number | — | Setting `zone2_presence_delay` |
| `zone_2_target_count` | Sensor | — | Capability `sensy_zone_people.zone2` (drawn zones only) · zone flows, widget |
| `zone_3_movement` | BinarySensor | — | Capability `sensy_zone_movement.zone3` (drawn zones only) · zone flows, widget |
| `zone_3_movement_threshold` | Number | — | Setting `zone3_movement_threshold` |
| `zone_3_p1_x` | Number | — | Zone outline · zone editor, widget |
| `zone_3_p1_y` | Number | — | Zone outline · zone editor, widget |
| `zone_3_p2_x` | Number | — | Zone outline · zone editor, widget |
| `zone_3_p2_y` | Number | — | Zone outline · zone editor, widget |
| `zone_3_p3_x` | Number | — | Zone outline · zone editor, widget |
| `zone_3_p3_y` | Number | — | Zone outline · zone editor, widget |
| `zone_3_p4_x` | Number | — | Zone outline · zone editor, widget |
| `zone_3_p4_y` | Number | — | Zone outline · zone editor, widget |
| `zone_3_p5_x` | Number | — | Zone outline · zone editor, widget |
| `zone_3_p5_y` | Number | — | Zone outline · zone editor, widget |
| `zone_3_p6_x` | Number | — | Zone outline · zone editor, widget |
| `zone_3_p6_y` | Number | — | Zone outline · zone editor, widget |
| `zone_3_p7_x` | Number | — | Zone outline · zone editor, widget |
| `zone_3_p7_y` | Number | — | Zone outline · zone editor, widget |
| `zone_3_p8_x` | Number | — | Zone outline · zone editor, widget |
| `zone_3_p8_y` | Number | — | Zone outline · zone editor, widget |
| `zone_3_points_count` | Number | — | Zone outline · zone editor, widget |
| `zone_3_presence` | BinarySensor | — | Capability `sensy_zone_presence.zone3` (drawn zones only) · zone flows, widget |
| `zone_3_presence_delay` | Number | — | Setting `zone3_presence_delay` |
| `zone_3_target_count` | Sensor | — | Capability `sensy_zone_people.zone3` (drawn zones only) · zone flows, widget |

## Targets

| Entity | Type | Category | In the app |
|---|---|---|---|
| `target_1_angle` | Sensor | — | Not used (x/y carry the same information) |
| `target_1_distance` | Sensor | — | Not used (x/y carry the same information) |
| `target_1_speed` | Sensor | — | Not used (x/y carry the same information) |
| `target_1_state` | TextSensor | — | Target state (moving / still / held) · widget markers |
| `target_1_x` | Sensor | — | Target position · widget, zone editor |
| `target_1_y` | Sensor | — | Target position · widget, zone editor |
| `target_2_angle` | Sensor | — | Not used (x/y carry the same information) |
| `target_2_distance` | Sensor | — | Not used (x/y carry the same information) |
| `target_2_speed` | Sensor | — | Not used (x/y carry the same information) |
| `target_2_state` | TextSensor | — | Target state (moving / still / held) · widget markers |
| `target_2_x` | Sensor | — | Target position · widget, zone editor |
| `target_2_y` | Sensor | — | Target position · widget, zone editor |
| `target_3_angle` | Sensor | — | Not used (x/y carry the same information) |
| `target_3_distance` | Sensor | — | Not used (x/y carry the same information) |
| `target_3_speed` | Sensor | — | Not used (x/y carry the same information) |
| `target_3_state` | TextSensor | — | Target state (moving / still / held) · widget markers |
| `target_3_x` | Sensor | — | Target position · widget, zone editor |
| `target_3_y` | Sensor | — | Target position · widget, zone editor |

## Climate and air

| Entity | Type | Category | In the app |
|---|---|---|---|
| `bme688_co__equivalent` | Sensor | — | Not shown (estimate or duplicate; see Air quality) |
| `bme688_gas_resistance__k__` | Sensor | — | Not shown (estimate or duplicate; see Air quality) |
| `bme688_humidity` | Sensor | — | Capability `measure_humidity` |
| `bme688_iaq` | Sensor | — | Capability `sensy_iaq` |
| `bme688_iaq_accuracy` | TextSensor | — | Capability `sensy_iaq_accuracy` |
| `bme688_iaq_classification` | TextSensor | — | Capability `sensy_air_quality` · *Air quality* flows |
| `bme688_pressure` | Sensor | — | Capability `measure_pressure` |
| `bme688_temp_offset` | Number | — | Setting `bme688_temp_offset` |
| `bme688_temperature` | Sensor | — | Capability `measure_temperature` |
| `bme688_voc_equivalent` | Sensor | — | Capability `measure_tvoc` |
| `ltr390_ambient_light__lux_` | Sensor | — | Capability `measure_luminance` |
| `ltr390_lux_offset` | Number | — | Setting `lux_offset` |
| `ltr390_uv_index` | Sensor | — | Capability `measure_ultraviolet` |
| `ltr390_uv_offset` | Number | — | Setting `uv_offset` |
| `scd40___factory_reset` | Button | config | Not offered (factory reset) |
| `scd40___forced_calibration` | Button | config | Maintenance action `button.calibrate_co2` |
| `scd40_co__concentration` | Sensor | — | Capability `measure_co2` |
| `scd40_humidity` | Sensor | — | Not shown (estimate or duplicate; see Air quality) |
| `scd40_temp_offset` | Number | — | Setting `scd40_temp_offset` |
| `scd40_temperature` | Sensor | — | Not shown (estimate or duplicate; see Air quality) |

## Radar

| Entity | Type | Category | In the app |
|---|---|---|---|
| `detection_range` | Number | — | Setting `detection_range` |
| `radar___bluetooth` | Switch | config | Capability with *Show configuration capabilities* |
| `radar___factory_reset` | Button | config | Not offered (factory reset) |
| `radar___flip_y_axis` | Switch | config | Setting `mirrored` |
| `radar___holding_engine` | Switch | config | Setting `holding` |
| `radar___restart_module` | Button | config | Maintenance action `button.restart_radar` |
| `radar___single_target` | Switch | config | Setting `single_target` |
| `radar_dropout_hold_time` | Number | — | Setting `dropout_hold_time` |
| `radar_gate_radius` | Number | — | Setting `gate_radius` |
| `radar_stationary_speed_threshold` | Number | — | Setting `stationary_speed_threshold` |
| `radar_stationary_time` | Number | — | Setting `stationary_time` |

## Device, buzzer and LED

| Entity | Type | Category | In the app |
|---|---|---|---|
| `ble___proxy` | Switch | config | Device warning when on · capability with *Show configuration* |
| `esp32___factory_reset` | Button | config | Not offered (factory reset) |
| `esp32___firmware_update` | Update | config | Not used: Homey checks GitHub itself (firmware notice) |
| `esp32___ip` | TextSensor | diagnostic | Capability with *Show diagnostic capabilities* |
| `esp32___restart_module` | Button | config | Maintenance action `button.restart` |
| `esp32___ssid` | TextSensor | diagnostic | Capability with *Show diagnostic capabilities* |
| `esp32___status` | BinarySensor | diagnostic | Capability with *Show diagnostic capabilities* |
| `esp32___temperature` | Sensor | diagnostic | Capability with *Show diagnostic capabilities* |
| `esp32___wifi_strength` | TextSensor | diagnostic | Capability with *Show diagnostic capabilities* |
| `mlt8530___buzzer` | Switch | config | *Beep* flow action · capability with *Show configuration* |
| `mlt8530_buzzer_pitch` | Number | — | Setting `buzzer_pitch` |
| `mlt8530_buzzer_volume` | Number | — | Setting `buzzer_volume` |
| `mode___realtime` | Switch | config | Setting `realtime` |
| `ws2812___led` | Light | config | Capability with *Show configuration capabilities* |
