import { expect, test } from '@playwright/test'

function localMusic() {
  const sampleRate = 8000
  const pcmSize = sampleRate * 2 * 2
  const wav = Buffer.alloc(44 + pcmSize)
  wav.write('RIFF')
  wav.writeUInt32LE(wav.length - 8, 4)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt16LE(1, 20)
  wav.writeUInt16LE(1, 22)
  wav.writeUInt32LE(sampleRate, 24)
  wav.writeUInt32LE(sampleRate * 2, 28)
  wav.writeUInt16LE(2, 32)
  wav.writeUInt16LE(16, 34)
  wav.write('data', 36)
  wav.writeUInt32LE(pcmSize, 40)
  for (let i = 0; i < pcmSize / 2; i++) {
    wav.writeInt16LE(Math.round(1000 * Math.sin((2 * Math.PI * 220 * i) / sampleRate)), 44 + i * 2)
  }
  return { name: 'test-music.wav', mimeType: 'audio/wav', buffer: wav }
}

test('workout cues lower local music and restore the volume without pausing it', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('form-locale', 'en')
    const connections = new WeakMap()
    const connect = AudioNode.prototype.connect
    AudioNode.prototype.connect = function (destination, ...channels) {
      connections.set(this, destination)
      return connect.call(this, destination, ...channels)
    }
    const createSource = AudioContext.prototype.createMediaElementSource
    AudioContext.prototype.createMediaElementSource = function (element) {
      const source = createSource.call(this, element)
      source.connect = function (level) {
        const duck = connections.get(level).gain
        window.musicMix = { element, level: level.gain, duck, minimum: 1 }
        const sample = () => {
          window.musicMix.minimum = Math.min(window.musicMix.minimum, duck.value)
          requestAnimationFrame(sample)
        }
        requestAnimationFrame(sample)
        return AudioNode.prototype.connect.call(this, level)
      }
      return source
    }
  })

  await page.goto('./#/player')
  await page.getByLabel('Local music (this session only)').setInputFiles(localMusic())
  await page.getByRole('button', { name: 'Start training', exact: true }).click()

  const mix = (key) =>
    page.evaluate((name) => {
      const mix = window.musicMix
      if (name === 'playing')
        return Boolean(mix && !mix.element.paused && mix.element.currentTime > 0)
      return name === 'minimum' ? mix?.minimum : mix?.[name]?.value
    }, key)
  await expect.poll(() => mix('playing')).toBe(true)
  await expect.poll(() => mix('level')).toBeCloseTo(0.35)

  await page.getByRole('button', { name: 'Preview work countdown' }).click()
  await expect.poll(() => mix('minimum')).toBeCloseTo(0.25, 1)
  await expect.poll(() => mix('duck')).toBeCloseTo(1)
  await expect.poll(() => mix('playing')).toBe(true)
  await expect.poll(() => mix('level')).toBeCloseTo(0.35)

  await page.getByRole('button', { name: 'Preview bell', exact: true }).click()
  await expect.poll(() => mix('duck')).toBeCloseTo(0.25, 1)
  await page.getByRole('slider', { name: 'Music volume' }).press('End')
  await expect.poll(() => mix('level')).toBeCloseTo(1)
  await expect.poll(() => mix('duck')).toBeCloseTo(1)
  await expect.poll(() => mix('playing')).toBe(true)
})
