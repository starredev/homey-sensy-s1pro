# Climate and air quality (/docs/air-quality)



The S1 Pro has two air sensors:

* the **SCD40**, a real CO₂ sensor (photoacoustic NDIR), for **CO₂**;
* the **BME688**, a gas sensor whose readings Bosch's BSEC software turns into an **air quality index (IAQ)**,
  an **air quality class**, a **VOC** estimate, and temperature, humidity and pressure.

## CO₂ [#co]

**CO₂** (ppm) is measured directly by the SCD40. It is the best indicator of how stale the air is in an occupied
room: people breathe out CO₂.

| CO₂ (ppm) | Typical meaning              |
| --------- | ---------------------------- |
| \~420     | Outdoor air                  |
| \< 800    | Well ventilated              |
| 800–1200  | Ventilation is getting short |
| > 1200    | Stuffy; ventilate            |

The official firmware turns the SCD40's automatic self-calibration **off** and compensates the reading with the
air pressure from the BME688. If the CO₂ reading drifts over the months (for example it never gets near \~420 ppm
with the windows wide open), use the [*Calibrate CO₂ sensor*](/docs/maintenance#calibrate-co2-sensor) maintenance
action.

## Air quality index (IAQ) [#air-quality-index-iaq]

**Air quality (IAQ)** is a number from 0 to 500 that Bosch's BSEC algorithm calculates from the BME688's gas
readings. It reacts to volatile compounds in the air: cooking, cleaning products, paint, perfume, people. Lower is
better.

The BME688 has no absolute scale: BSEC learns what clean and polluted air look like *in your room*, so the IAQ is
relative to the history of that room.

## Air quality class [#air-quality-class]

**Air quality** turns the IAQ into words. The sensor's firmware uses these ranges:

| Class                   | IAQ        |
| ----------------------- | ---------- |
| **Excellent**           | 0–50       |
| **Good**                | 51–100     |
| **Lightly polluted**    | 101–150    |
| **Moderately polluted** | 151–200    |
| **Heavily polluted**    | 201–250    |
| **Severely polluted**   | 251–350    |
| **Extremely polluted**  | 351 and up |

The [*Air quality changed*](/docs/flows#when) trigger and the [*Air quality is … or worse*](/docs/flows#and)
condition use these classes.

## Calibration [#calibration]

**Air quality calibration** tells you how reliable the IAQ, the class and the VOC are right now. It does not
measure anything itself.

| State           | Meaning                                                                        |
| --------------- | ------------------------------------------------------------------------------ |
| **Stabilizing** | Just started; the gas sensor is still warming up. The values mean nothing yet. |
| **Uncertain**   | Too little history; the values are rough.                                      |
| **Calibrating** | BSEC is learning the room and getting better.                                  |
| **Calibrated**  | BSEC knows the room. IAQ, class and VOC are reliable.                          |

Getting to *Calibrated* takes hours to a few days. It goes fastest when the sensor experiences both fresh air
(a window open) and polluted air. After a power cut or restart the state can drop back a step.

CO₂ comes from the separate SCD40 and does **not** depend on this calibration.

## VOC [#voc]

**VOC** (ppm) is BSEC's estimate of the concentration of volatile organic compounds, derived from the same gas
readings as the IAQ. Use it as a trend ("something is going on in the kitchen") rather than as an absolute
measurement.

## Not shown on the device [#not-shown-on-the-device]

The sensor reports a few more air values that the app leaves off the tile on purpose:

| Entity on the sensor           | Why it is not shown                                                                  |
| ------------------------------ | ------------------------------------------------------------------------------------ |
| BME688 CO₂ equivalent          | An estimate from the gas sensor; the real CO₂ from the SCD40 is shown instead.       |
| BME688 gas resistance          | A raw value that BSEC already turns into IAQ and VOC.                                |
| SCD40 temperature and humidity | Duplicates of the BME688 values; the SCD40 uses them internally for its CO₂ reading. |
