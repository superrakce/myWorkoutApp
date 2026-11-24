// Inharmonic partials decay at different rates to approximate a struck metal bell.
const partials = [
  { frequency: 560, level: 0.34, decay: 0.19 },
  { frequency: 908, level: 0.29, decay: 0.32 },
  { frequency: 1438, level: 0.22, decay: 0.17 },
  { frequency: 2164, level: 0.15, decay: 0.09 },
  { frequency: 3527, level: 0.12, decay: 0.03 },
]
const strikes = { working: 1, resting: 2, cooldown: 2, completed: 3 }

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

export async function playWorkoutBell(phase, volume) {
  const count = strikes[phase]
  if (!context || !count || !volume || document.hidden) return

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

    for (let strike = 0; strike < count; strike++) {
      const at = start + strike * 0.18
      for (const { frequency, level, decay } of partials) {
        const oscillator = context.createOscillator()
        const envelope = context.createGain()
        oscillator.frequency.value = frequency
        envelope.gain.setValueAtTime(0, at)
        envelope.gain.linearRampToValueAtTime(level, at + 0.004)
        envelope.gain.setTargetAtTime(0, at + 0.004, decay)
        oscillator.connect(envelope)
        envelope.connect(bell)
        oscillator.start(at)
        oscillator.stop(at + 1.4)
        lastOscillator = oscillator
      }
    }

    lastOscillator.onended = () => {
      if (output === bell) stopWorkoutBell()
    }
  } catch {
    if (id === cueId) stopWorkoutBell()
  }
}
