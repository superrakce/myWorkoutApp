export const ACCOUNT_KEY = 'form-account-session-v1'
export const AUTH_KEY = 'form-google-authorization-v1'
// Tab-scoped session state is deliberately excluded from workspaces and backups.
export function createAccountSession(getStorage = () => globalThis.sessionStorage) {
  function remove(key) { try { getStorage()?.removeItem(key) } catch {} }
  function read(key) { try { return JSON.parse(getStorage()?.getItem(key) || 'null') } catch { remove(key); return null } }
  function write(key, value) { try { getStorage()?.setItem(key, JSON.stringify(value)) } catch {} }
  function readAccount() {
    const value = read(ACCOUNT_KEY)
    if (!value || typeof value.sub !== 'string' || !/^[a-zA-Z0-9_-]{1,256}$/.test(value.sub) ||
      !['name','email'].every(k => typeof value[k] === 'string' && value[k].length <= 320)) {
      remove(ACCOUNT_KEY); return null
    }
    return { sub: value.sub, name: value.name, email: value.email }
  }
  function rememberAccount(person) {
    if (!person) { remove(ACCOUNT_KEY); return }
    write(ACCOUNT_KEY, { sub: person.sub, name: person.name || '', email: person.email || '' })
  }
  function readAuthorization(now) {
    const value = read(AUTH_KEY)
    if (!value || typeof value.token !== 'string' || !value.token || value.token.length > 8192 ||
      typeof value.sub !== 'string' || !/^[a-zA-Z0-9_-]{1,256}$/.test(value.sub) ||
      typeof value.drive !== 'boolean' || !Number.isFinite(value.expiresAt) ||
      value.expiresAt - now < 30000 || value.expiresAt - now > 86400000) {
      remove(AUTH_KEY); return null
    }
    return value
  }
  return { readAccount, rememberAccount, readAuthorization,
    cacheAuthorization: value => write(AUTH_KEY, value),
    clearAuthorization: () => remove(AUTH_KEY) }
}
export const accountSession = createAccountSession()
