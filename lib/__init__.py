"""Sensy S1 Pro app code.

Layers, from the bottom up (imports only point downwards):

- ``lib.errors``, ``lib.timers``, ``lib.utils``: shared building blocks.
- ``lib.sensor``: the S1 Pro model (zones, targets, events, firmware profile).
  Knows nothing about Homey.
- ``lib.esphome``: the entity port between the sensor model and the
  ``homey-esphomedriver`` session.
- ``lib.homey``: Homey adapters (flow cards, capabilities, settings, realtime,
  web API, brand profile).
"""
