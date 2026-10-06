# Settings

All device settings, with their id, type, range and the sensor entity they mirror. Settings with a sensor
entity are kept in sync in both directions; see the [Device settings guide](../guide/settings.md) for what they do.

## Detection

| Setting | Id | Type | Default | Range | Sensor entity |
|---|---|---|---|---|---|
| Detection range | `detection_range` | number | 600 | 0 – 1800 cm | `detection_range` |
| Presence hold time | `any_presence_delay` | number | 0 | 0 – 3600 s | `any_presence_delay` |
| Movement threshold | `any_movement_threshold` | number | 0 | 0 – 5000 cm/s | `any_movement_threshold` |
| Track a single person | `single_target` | checkbox | False |  | `radar___single_target` |
| Mirrored mounting | `mirrored` | checkbox | False |  | `radar___flip_y_axis` |
| Real-time environment readings | `realtime` | checkbox | True |  | `mode___realtime` |

## Zone 1

| Setting | Id | Type | Default | Range | Sensor entity |
|---|---|---|---|---|---|
| Presence hold time | `zone1_presence_delay` | number | 0 | 0 – 3600 s | `zone_1_presence_delay` |
| Movement threshold | `zone1_movement_threshold` | number | 0 | 0 – 5000 cm/s | `zone_1_movement_threshold` |

## Zone 2

| Setting | Id | Type | Default | Range | Sensor entity |
|---|---|---|---|---|---|
| Presence hold time | `zone2_presence_delay` | number | 0 | 0 – 3600 s | `zone_2_presence_delay` |
| Movement threshold | `zone2_movement_threshold` | number | 0 | 0 – 5000 cm/s | `zone_2_movement_threshold` |

## Zone 3

| Setting | Id | Type | Default | Range | Sensor entity |
|---|---|---|---|---|---|
| Presence hold time | `zone3_presence_delay` | number | 0 | 0 – 3600 s | `zone_3_presence_delay` |
| Movement threshold | `zone3_movement_threshold` | number | 0 | 0 – 5000 cm/s | `zone_3_movement_threshold` |

## Tracking

| Setting | Id | Type | Default | Range | Sensor entity |
|---|---|---|---|---|---|
| Hold people who stand still | `holding` | checkbox | False |  | `radar___holding_engine` |
| Stationary speed | `stationary_speed_threshold` | number | 45 | 0 – 100 cm/s | `radar_stationary_speed_threshold` |
| Hold after standing still | `stationary_time` | number | 55 | 0 – 120 s | `radar_stationary_time` |
| Hold time | `dropout_hold_time` | number | 15 | 0 – 60 min | `radar_dropout_hold_time` |
| Jump distance | `gate_radius` | number | 100 | 5 – 300 cm | `radar_gate_radius` |

## Calibration

| Setting | Id | Type | Default | Range | Sensor entity |
|---|---|---|---|---|---|
| Temperature offset | `bme688_temp_offset` | number | 0 | -50 – 50 °C | `bme688_temp_offset` |
| CO₂ sensor temperature offset | `scd40_temp_offset` | number | 0 | -50 – 50 °C | `scd40_temp_offset` |
| Light offset | `lux_offset` | number | 0 | -10000 – 10000 lx | `ltr390_lux_offset` |
| UV index offset | `uv_offset` | number | 0 | -50 – 50 | `ltr390_uv_offset` |

## Buzzer

| Setting | Id | Type | Default | Range | Sensor entity |
|---|---|---|---|---|---|
| Pitch | `buzzer_pitch` | number | 2700 | 100 – 8000 Hz | `mlt8530_buzzer_pitch` |
| Volume | `buzzer_volume` | number | 50 | 0 – 100 % | `mlt8530_buzzer_volume` (× 100) |

## Device

| Setting | Id | Type | Default | Range | Sensor entity |
|---|---|---|---|---|---|
| Device class | `device_class` | dropdown | auto |  | *(homey-esphomedriver)* |

## Capabilities

| Setting | Id | Type | Default | Range | Sensor entity |
|---|---|---|---|---|---|
| Show diagnostic capabilities | `show_diagnostics` | checkbox | False |  | *(homey-esphomedriver)* |
| Show configuration capabilities | `show_configuration` | checkbox | False |  | *(homey-esphomedriver)* |

## Device Information

| Setting | Id | Type | Default | Range | Sensor entity |
|---|---|---|---|---|---|
| Host / IP | `host` | label |  |  | *(homey-esphomedriver)* |
| API port | `port` | label |  |  | *(homey-esphomedriver)* |
| Encryption | `encryption` | label |  |  | *(homey-esphomedriver)* |
| Manufacturer | `manufacturer` | label |  |  | *(homey-esphomedriver)* |
| Model | `model` | label |  |  | *(homey-esphomedriver)* |
| MAC address | `mac` | label |  |  | *(homey-esphomedriver)* |
| Hostname | `hostname` | label |  |  | *(homey-esphomedriver)* |
| ESPHome version | `esphome_version` | label |  |  | *(homey-esphomedriver)* |
| Compilation time | `compilation_time` | label |  |  | *(homey-esphomedriver)* |
| Project | `project` | label |  |  | *(homey-esphomedriver)* |
| Bluetooth MAC | `bluetooth_mac` | label |  |  | *(homey-esphomedriver)* |
| Web server | `webserver` | label |  |  | *(homey-esphomedriver)* |
| Deep sleep enabled | `deep_sleep` | label |  |  | *(homey-esphomedriver)* |

Homey reserves setting ids that start with `zone_`, which is why the zone settings are called `zone1_…`.
