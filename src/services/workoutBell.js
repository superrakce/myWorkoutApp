// Inharmonic partials decay at different rates to approximate a struck metal bell.
const partials = [
  { frequency: 560, level: 0.34, decay: 0.19 },
  { frequency: 908, level: 0.29, decay: 0.32 },
  { frequency: 1438, level: 0.22, decay: 0.17 },
  { frequency: 2164, level: 0.15, decay: 0.09 },
  { frequency: 3527, level: 0.12, decay: 0.03 },
]
const strikes = { working: 1, resting: 2, cooldown: 2, completed: 3 }
const countdownTones = { workingEnding: [420], restingEnding: [900, 1220] }

function countdownPattern(cue, offset = 0) {
  return (countdownTones[cue] || []).map((frequency, index) => ({
    offset: offset + index * 0.12,
    duration: 0.16,
    modes: [{ frequency, level: 0.5, decay: 0.042 }],
  }))
}

let context
let unlocking
let output
let cueId = 0

export function unlockWorkoutBell() {
  const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext
  if (!AudioContext) return
  try {
    context ??= new AudioContext()
    if (context.state !== 'running') {
      const attempt = context.resume()
      unlocking = attempt
      const clearUnlock = () => {
        if (unlocking === attempt) unlocking = undefined
      }
      attempt.then(clearUnlock, clearUnlock)
    }
  } catch {}
}

export function stopWorkoutBell() {
  cueId++
  output?.disconnect()
  output = undefined
}

export async function playWorkoutBell(phase, volume, startsAtThree = false) {
  if (!context || !volume || document.hidden) return
  const pattern = strikes[phase]
    ? Array.from({ length: strikes[phase] }, (_, index) => ({
        offset: index * 0.18,
        duration: 1.4,
        modes: partials,
      }))
    : countdownPattern(phase)
  // A three-second stage starts with the usual bell, then plays the warning before the timer shows 2.
  if (startsAtThree) pattern.push(...countdownPattern(phase + 'Ending', 0.55))
  if (!pattern.length) return

  stopWorkoutBell()
  const id = cueId
  try {
    if (context.state !== 'running') await unlocking
    if (id !== cueId || context.state !== 'running' || document.hidden) return

    const bell = context.createGain()
    output = bell
    bell.gain.value = volume * 0.65
    bell.connect(context.destination)
    const start = context.currentTime + 0.01
    let lastOscillator
    let lastEnd = 0

    for (const { offset, duration, modes } of pattern) {
      const at = start + offset
      const end = at + duration
      for (const { frequency, level, decay } of modes) {
        const oscillator = context.createOscillator()
        const envelope = context.createGain()
        oscillator.frequency.value = frequency
        envelope.gain.setValueAtTime(0, at)
        envelope.gain.linearRampToValueAtTime(level, at + 0.004)
        envelope.gain.setTargetAtTime(0, at + 0.004, decay)
        oscillator.connect(envelope)
        envelope.connect(bell)
        oscillator.start(at)
        oscillator.stop(end)
        if (end > lastEnd) {
          lastEnd = end
          lastOscillator = oscillator
        }
      }
    }

    lastOscillator.onended = () => {
      if (output === bell) stopWorkoutBell()
    }
  } catch {
    if (id === cueId) stopWorkoutBell()
  }
}
