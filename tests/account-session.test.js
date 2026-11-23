import 'fake-indexeddb/auto'
import { describe, it, expect, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { createAccountSession, ACCOUNT_KEY, AUTH_KEY } from '../src/services/accountSession.js'
import { createGoogleIdentity, DRIVE_SCOPE } from '../src/services/googleIdentity.js'
import { useAppStore } from '../src/stores/app.js'
function memory() {
  const values = new Map()
  return { getItem: key => values.get(key) ?? null, setItem: (key,value) => values.set(key,value), removeItem: key => values.delete(key) }
}
const person = { sub: 'refresh_account_a', name: 'Refresh A', email: 'refresh-a@example.test' }
const clientId = 'test.apps.googleusercontent.com'
function saved(session, extra = {}) {
  session.cacheAuthorization({ clientId, token: 'temporary-test-token', sub: person.sub, drive: true, expiresAt: 3601000, ...extra })
}
describe('tab session restoration', () => {
  it('restores a valid token only after verifying the remembered Google account', async () => {
    const storage = memory(), session = createAccountSession(() => storage)
    session.rememberAccount(person); saved(session)
    const fetcher = vi.fn(async () => ({ ok: true, json: async () => person }))
    const auth = createGoogleIdentity({ clientId, session, now: () => 1000, fetcher })
    expect(() => auth.access(person.sub)).toThrow('syncNeedsAuth')
    expect(await auth.restore(person.sub)).toEqual(person)
    expect(auth.access(person.sub)).toBe('temporary-test-token')
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer temporary-test-token')
    auth.clear(); expect(storage.getItem(AUTH_KEY)).toBeNull()
  })
  it('keeps the account while expired or revoked authorization requires reconnecting', async () => {
    const storage = memory(), session = createAccountSession(() => storage)
    session.rememberAccount(person); saved(session, { expiresAt: 1001 })
    const fetcher = vi.fn()
    const auth = createGoogleIdentity({ clientId, session, now: () => 1000, fetcher })
    expect(await auth.restore(person.sub)).toBeNull()
    expect(fetcher).not.toHaveBeenCalled(); expect(session.readAccount()).toEqual(person)
    saved(session)
    fetcher.mockResolvedValue({ ok: false })
    await expect(auth.restore(person.sub)).rejects.toThrow('syncNeedsAuth')
    expect(storage.getItem(AUTH_KEY)).toBeNull()
    expect(session.readAccount()).toEqual(person)
  })
  it('rejects account mismatch and does not reuse credentials for another client', async () => {
    const session = createAccountSession(() => memoryStorage)
    const memoryStorage = memory()
    saved(session)
    const auth = createGoogleIdentity({ clientId, session, now: () => 1000,
      fetcher: async () => ({ ok: true, json: async () => ({ ...person, sub: 'other_account' }) }) })
    await expect(auth.restore(person.sub)).rejects.toThrow('syncAccountMismatch')
    expect(() => auth.access(person.sub)).toThrow('syncNeedsAuth')
    saved(session, { clientId: 'another.apps.googleusercontent.com' })
    expect(await auth.restore(person.sub)).toBeNull()
  })
  it('does not revive an authorization after sign-out during verification', async () => {
    const session = createAccountSession(() => storage), storage = memory()
    saved(session)
    let finish
    const auth = createGoogleIdentity({ clientId, session, now: () => 1000,
      fetcher: () => new Promise(resolve => { finish = resolve }) })
    const pending = auth.restore(person.sub), check = expect(pending).rejects.toThrow('syncAccountChanged')
    auth.clear(); finish({ ok: true, json: async () => person }); await check
    expect(() => auth.access(person.sub)).toThrow('syncNeedsAuth')
    expect(storage.getItem(AUTH_KEY)).toBeNull()
  })
  it('retains local account selection after network failure and handles blocked storage', async () => {
    const storage = memory(), session = createAccountSession(() => storage)
    session.rememberAccount(person); saved(session)
    const auth = createGoogleIdentity({ clientId, session, now: () => 1000, fetcher: async () => { throw Error('offline') } })
    await expect(auth.restore(person.sub)).rejects.toThrow('offline')
    expect(session.readAccount()).toEqual(person)
    expect(storage.getItem(AUTH_KEY)).not.toBeNull()
    const blocked = createAccountSession(() => { throw Error('blocked') })
    expect(blocked.readAccount()).toBeNull()
    expect(blocked.readAuthorization(1000)).toBeNull()
    expect(() => blocked.rememberAccount(person)).not.toThrow()
    storage.setItem(ACCOUNT_KEY, '{bad json')
    expect(session.readAccount()).toBeNull()
  })
  it('restores the same scoped workspace and forgets it after explicit sign-out', async () => {
    const storage = memory(); vi.stubGlobal('sessionStorage', storage)
    try {
      setActivePinia(createPinia()); const first = useAppStore(); await first.init()
      await first.openAccount(person)
      first.data.meals.push({ id: 'session-meal', date: '2026-11-23', meal: 'lunch', name: 'Saved local meal', kcal: 120 })
      await first.persist()
      expect(JSON.stringify(first.backup())).not.toContain('form-google-authorization')
      setActivePinia(createPinia()); const refreshed = useAppStore(); await refreshed.init()
      expect(refreshed.identity).toEqual(person)
      expect(refreshed.scope).toBe('google:' + person.sub)
      expect(refreshed.data.meals[0].name).toBe('Saved local meal')
      const signingOut = refreshed.signOut(); expect(storage.getItem(ACCOUNT_KEY)).toBeNull(); await signingOut
      setActivePinia(createPinia()); const signedOut = useAppStore(); await signedOut.init()
      expect(signedOut.scope).toBe('guest'); expect(signedOut.identity).toBeNull()
    } finally { vi.unstubAllGlobals() }
  })
})
