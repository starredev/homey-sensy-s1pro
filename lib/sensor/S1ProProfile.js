import { roundTo } from '../utils.js';
import { Zone } from './Zone.js';
import {
  CapabilityBinding,
  NumberSettingBinding,
  SwitchSettingBinding,
  TargetFeed,
} from './bindings.js';

/**
 * Everything that is specific to the Sensy-One S1 Pro firmware: entity ids,
 * which entity feeds which capability and which entity backs which setting.
 * Supporting another firmware revision should only require changes here.
 *
 * Both the official Sensy-One firmware and the Homey edition are supported;
 * they share all entities except the ones that report live target positions.
 */
export const S1ProProfile = Object.freeze({
  /** ESPHome project name of the sensor; keep in sync with `.homeycompose/discovery/sensy-s1pro.json`. */
  projectName: 'Sensy-One.S1 Pro Multi Sense',

  /** Name for a sensor that reports none. */
  defaultName: 'Sensy S1 Pro',

  /** Entities with a fixed meaning. */
  entities: Object.freeze({
    presence: 'any_presence',
    movement: 'any_movement',
    people: 'all_targets_count',
    detectionRange: 'detection_range',
    buzzer: 'mlt8530___buzzer',
    ipAddress: 'esp32___ip',
    /** Official firmware only: Bluetooth proxy for Home Assistant, off by default. */
    bluetoothProxy: 'ble___proxy',
  }),

  /** Patterns of entity families; capture groups carry the variable parts. */
  patterns: Object.freeze({
    /** `zone_1_presence` → zone 1, kind presence */
    zoneState: /^zone_([1-3])_(presence|movement|target_count)$/,
    /** Any entity that changes the outline of a zone. */
    zoneGeometry: /^(?:zone_[1-3]|exclusion_zone)_(?:points_count|p[1-8]_[xy])$/,
  }),

  /** Live target positions, per firmware variant. */
  targetFeeds: Object.freeze([
    // Official firmware: the radar's own sensors. Every frame publishes x then y; (0, 0) means empty.
    new TargetFeed({
      name: 'official',
      pattern: /^target_([1-3])_([xy])$/,
      isEmpty: (x, y) => {
        return x === 0 && y === 0;
      },
      completeOn: 'y',
    }),
    // Homey edition: light template sensors, each sent only when it moved; -9999 means empty.
    new TargetFeed({
      name: 'homey-edition',
      pattern: /^live_t([1-3])_([xy])$/,
      isEmpty: (x, y) => {
        return x < -9000 || y < -9000;
      },
    }),
  ]),

  capabilities: Object.freeze([
    new CapabilityBinding('any_presence', 'alarm_motion', Boolean),
    new CapabilityBinding('any_movement', 'sensy_moving', Boolean),
    new CapabilityBinding('all_targets_count', 'sensy_people', roundTo(0)),
    new CapabilityBinding('bme688_temperature', 'measure_temperature', roundTo(1)),
    new CapabilityBinding('bme688_humidity', 'measure_humidity', roundTo(1)),
    new CapabilityBinding('scd40_co____concentration', 'measure_co2', roundTo(0)),
    new CapabilityBinding('bme688_iaq', 'sensy_iaq', roundTo(0)),
    new CapabilityBinding('bme688_pressure', 'measure_pressure', roundTo(1)),
    new CapabilityBinding('ltr390_ambient_light__lux_', 'measure_luminance', roundTo(0)),
    new CapabilityBinding('ltr390_uv_index', 'measure_ultraviolet', roundTo(1)),
  ]),

  settings: Object.freeze([
    new NumberSettingBinding('detection_range', 'detection_range'),
    new NumberSettingBinding('any_presence_delay', 'any_presence_delay'),
    new NumberSettingBinding('any_movement_threshold', 'any_movement_threshold'),
    ...Zone.DETECTION.flatMap((zone) => [
      new NumberSettingBinding(`zone${zone.number}_presence_delay`, zone.entity('presence_delay')),
      new NumberSettingBinding(`zone${zone.number}_movement_threshold`, zone.entity('movement_threshold')),
    ]),
    new NumberSettingBinding('bme688_temp_offset', 'bme688_temp_offset'),
    new NumberSettingBinding('scd40_temp_offset', 'scd40_temp_offset'),
    new SwitchSettingBinding('single_target', 'radar___single_target'),
  ]),

  limits: Object.freeze({
    presenceDelay: Object.freeze({ min: 0, max: 3600 }),
    movementThreshold: Object.freeze({ min: 0, max: 5000 }),
    beepSeconds: Object.freeze({ min: 0.1, max: 5, fallback: 0.3 }),
    defaultDetectionRange: 600,
  }),
});
