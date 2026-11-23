import {describe,it,expect,vi} from 'vitest'
import {createGoogleIdentity,DRIVE_SCOPE} from '../src/services/googleIdentity.js'
function setup(person={sub:'google_user_a',name:'User A',email:'a@example.test'}){
 let options
 const google={accounts:{oauth2:{initTokenClient:o=>{options=o;return {requestAccessToken:()=>{}}},revoke:(token,cb)=>cb({})}}}
 const fetcher=vi.fn(async()=>({ok:true,json:async()=>person}))
 const auth=createGoogleIdentity({clientId:'test.apps.googleusercontent.com',getGoogle:()=>google,fetcher,now:()=>1000})
 return {auth,fetcher,respond:r=>options.callback(r),close:()=>options.error_callback()}
}
const token={access_token:'test-token-only',expires_in:3600,scope:'openid email profile '+DRIVE_SCOPE}
describe('Google identity boundary',()=>{
 it('keeps tokens private and derives the account from Google userinfo',async()=>{
  const s=setup(),pending=s.auth.authorize(true);await s.respond(token);const person=await pending
  expect(person).toEqual({sub:'google_user_a',name:'User A',email:'a@example.test'})
  expect(JSON.stringify(person)).not.toContain('test-token-only')
  expect(s.auth.access(person.sub)).toBe('test-token-only')
  expect(s.fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer test-token-only')
 })
 it('rejects a token for another account',async()=>{
  const s=setup(),p=s.auth.authorize(true,'google_user_b'),check=expect(p).rejects.toThrow('syncAccountMismatch')
  await s.respond(token);await check;expect(()=>s.auth.access('google_user_a')).toThrow('syncNeedsAuth')
 })
 it('requires Drive permission separately from sign-in',async()=>{
  const s=setup(),p=s.auth.authorize(false);await s.respond({...token,scope:'openid email profile'});await p
  expect(()=>s.auth.access('google_user_a')).toThrow('syncNeedsAuth')
 })
 it('handles declined consent and missing Drive scope',async()=>{
  const s=setup(),p=s.auth.authorize(true),check=expect(p).rejects.toThrow('syncDenied');await s.respond({...token,scope:'openid email profile'});await check
 })
 it('invalidates in-flight authorization after signing out',async()=>{
  const s=setup(),p=s.auth.authorize(true),check=expect(p).rejects.toThrow('syncAccountChanged');s.auth.clear();await s.respond(token);await check
 })
 it('does not use expired tokens or persist them through clear',async()=>{
  const s=setup(),p=s.auth.authorize(true);await s.respond({...token,expires_in:1});await p
  expect(()=>s.auth.access('google_user_a')).toThrow('syncNeedsAuth')
 })
 it('handles popup close and missing configuration',async()=>{
  const s=setup(),p=s.auth.authorize(),check=expect(p).rejects.toThrow('syncPopupClosed');s.close();await check
  await expect(createGoogleIdentity({clientId:''}).authorize()).rejects.toThrow('syncNotConfigured')
 })
 it('revokes access without exposing the token to callers',async()=>{
  const s=setup(),p=s.auth.authorize(true);await s.respond(token);await p;await s.auth.revoke('google_user_a')
  expect(()=>s.auth.access('google_user_a')).toThrow('syncNeedsAuth')
 })
})
