import { useTuner } from '../audio/useTuner'
import { useTuning } from '../theory/useTuning'
import { stringLabels, stringOrdinal } from '../theory/tuning'
import type { Tuning } from '../theory/tuning'
import './Tuner.css'

/**
 * Microphone tuner. Defaults to the app-wide guitar tuning (header selector);
 * pass a fixed `tuning` (e.g. the 4-string bass) to tune to that instead, with
 * no header control.
 */
export default function Tuner({ tuning: tuningProp }: { tuning?: Tuning } = {}) {
  const { tuning: guitarTuning } = useTuning()
  const tuning = tuningProp ?? guitarTuning
  const fixedTuning = tuningProp != null
  const labels = stringLabels(tuning)
  const {
    status,
    reading: rawReading,
    devices,
    deviceId,
    setDeviceId,
    lockedString,
    setLockedString,
    errorMsg,
    start,
    stop,
  } = useTuner(tuning)

  // Ignore a reading whose string index is out of range for the current tuning.
  // This can happen for a single render right after switching tunings (before
  // the hook's reset effect clears it) and would otherwise index out of bounds.
  const reading =
    rawReading &&
    rawReading.targetString >= 0 &&
    rawReading.targetString < labels.length
      ? rawReading
      : null

  const listening = status === 'listening'
  const cents = reading?.cents ?? 0
  // Needle position: -50 cents → 0%, 0 → 50%, +50 → 100%.
  const needlePct = Math.min(100, Math.max(0, 50 + cents))
  const inTune = reading?.inTune ?? false

  const direction = !reading
    ? 'Play a string…'
    : inTune
      ? 'In tune ✓'
      : cents < 0
        ? 'Too low — tune up ↑'
        : 'Too high — tune down ↓'

  return (
    <section className="tuner col">
      <div className="panel tuner-main col">
        {/* String selector (also the auto/lock control). */}
        <div className="control">
          <label id="tuner-strings-label">
            Tune to <span className="muted">· {lockedString === null ? 'auto-detect' : 'locked'}</span>
          </label>
          <div className="chip-row" role="group" aria-labelledby="tuner-strings-label">
            <button
              type="button"
              className="chip"
              aria-pressed={lockedString === null}
              onClick={() => setLockedString(null)}
            >
              Auto
            </button>
            {labels.map((label, i) => (
              <button
                key={i}
                type="button"
                className={
                  'chip tuner-string' +
                  (listening && reading?.targetString === i ? ' is-target' : '')
                }
                aria-pressed={lockedString === i}
                onClick={() => setLockedString(lockedString === i ? null : i)}
                title={`${stringOrdinal(tuning, i)} string`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Big readout */}
        <div className={'tuner-readout' + (inTune ? ' is-intune' : '')}>
          <div className="tuner-note mono">
            {reading ? labels[reading.targetString].toUpperCase() : '–'}
          </div>
          <div className="muted tuner-sub">
            {reading
              ? `${stringOrdinal(tuning, reading.targetString)} string${
                  reading.note ? ` · heard ${reading.note}${reading.octave}` : ''
                }`
              : listening
                ? 'Listening…'
                : 'Mic off'}
          </div>
        </div>

        {/* Cents meter */}
        <div
          className="tuner-meter"
          role="img"
          aria-label={
            reading ? `${cents} cents ${cents < 0 ? 'flat' : 'sharp'}` : 'no signal'
          }
        >
          <div className="tuner-meter-track">
            <span className="tuner-meter-center" />
            {reading ? (
              <span
                className={'tuner-needle' + (inTune ? ' is-intune' : '')}
                style={{ left: `${needlePct}%` }}
              />
            ) : null}
          </div>
          <div className="tuner-meter-scale muted mono">
            <span>♭ -50</span>
            <span>0</span>
            <span>+50 ♯</span>
          </div>
        </div>

        <div className={'tuner-direction' + (inTune ? ' is-intune' : '')}>
          {listening ? direction : ''}
        </div>
        {reading ? (
          <div className="muted mono tuner-hz">
            {reading.cents > 0 ? '+' : ''}
            {reading.cents} cents · {reading.frequency} Hz
          </div>
        ) : null}

        {/* Transport */}
        <button
          type="button"
          className={`btn ${listening ? '' : 'btn-primary'} tuner-transport`}
          onClick={listening ? stop : start}
          disabled={status === 'requesting'}
        >
          {status === 'requesting'
            ? 'Allow microphone…'
            : listening
              ? 'Stop'
              : 'Start tuning'}
        </button>

        {/* Input device picker (labels appear after permission is granted). */}
        {devices.length > 1 ? (
          <div className="control">
            <label htmlFor="tuner-device">Input</label>
            <select
              id="tuner-device"
              value={deviceId ?? ''}
              onChange={(e) => setDeviceId(e.target.value || null)}
            >
              <option value="">Default input</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {errorMsg ? (
          <p className="tuner-msg" role="alert">
            {errorMsg}
          </p>
        ) : null}

        <p className="muted tuner-hint">
          {tuning.name}. Play one string and let it ring; tap a string above to
          lock onto it, or leave it on Auto.
          {fixedTuning ? '' : ' (Change the tuning in the header.)'}
        </p>
      </div>
    </section>
  )
}
