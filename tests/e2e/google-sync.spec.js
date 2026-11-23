import {test,expect} from '@playwright/test'
import {readFile} from 'node:fs/promises'
function cloudStorage(){return {users:new Map(),next:1,reject:false}}
async function mockGoogle(page,cloud){
 await page.addInitScript(()=>{localStorage.setItem('form-locale','en');window.mockAccount='user_a';window.mockExpires=3600})
 await page.route('https://accounts.google.com/gsi/client',route=>route.fulfill({contentType:'application/javascript',body:`window.google={accounts:{oauth2:{initTokenClient(options){return {requestAccessToken(){queueMicrotask(()=>options.callback({access_token:'mock-access-'+window.mockAccount,expires_in:window.mockExpires,scope:options.scope}))}}},revoke(token,callback){callback({})}}}}`}))
 await page.route('https://openidconnect.googleapis.com/v1/userinfo',route=>{
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,DELETE,OPTIONS','access-control-allow-headers':'authorization,content-type'}})
  const sub=route.request().headers().authorization.replace('Bearer mock-access-','')
  return route.fulfill({json:{sub,name:sub==='user_a'?'User A':'User B',email:sub+'@example.test'},headers:{'access-control-allow-origin':'*'}})
 })
 await page.route('https://www.googleapis.com/**',async route=>{
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers:{'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,DELETE,OPTIONS','access-control-allow-headers':'authorization,content-type'}})
  const request=route.request(),url=new URL(request.url()),sub=(request.headers().authorization||'').replace('Bearer mock-access-','')
  const headers={'access-control-allow-origin':'*'}
  if(!cloud.users.has(sub))cloud.users.set(sub,new Map())
  const files=cloud.users.get(sub)
  if(cloud.reject)return route.fulfill({status:401,json:{error:{message:'expired'}},headers})
  if(request.method()==='POST'){
    const boundary=request.headers()['content-type'].split('boundary=')[1]
    const parts=request.postData().split('--'+boundary).filter(x=>x.includes('Content-Type:'))
    const parse=part=>JSON.parse(part.slice(part.indexOf('\r\n\r\n')+4).trim())
    const metadata=parse(parts[0]),event=parse(parts[1]),id='drive_'+cloud.next++,md5Checksum=id
    files.set(id,{metadata,event,md5Checksum})
    return route.fulfill({json:{id,md5Checksum},headers})
  }
  const id=url.pathname.split('/').at(-1)
  if(request.method()==='DELETE'){files.delete(id);return route.fulfill({status:204,headers})}
  if(url.searchParams.get('alt')==='media'){
    if(!files.has(id))return route.fulfill({status:404,json:{},headers})
    return route.fulfill({json:files.get(id).event,headers})
  }
  return route.fulfill({json:{files:[...files].map(([id,f])=>({id,name:f.metadata.name,md5Checksum:f.md5Checksum,size:String(JSON.stringify(f.event).length)}))},headers})
 })
}
async function login(page,account='user_a'){
 await page.goto('http://127.0.0.1:5173/#/settings')
 await page.evaluate(account=>{window.mockAccount=account},account)
 await page.getByRole('button',{name:'Sign in with Google',exact:true}).click()
 await expect(page.getByText(account+'@example.test',{exact:true})).toBeVisible()
 await page.getByRole('button',{name:'Enable Google Drive sync',exact:true}).click()
 await expect(page.getByTestId('sync-status')).toHaveText('Synced to your Drive')
}
async function addMeal(page,name){
 await page.goto('http://127.0.0.1:5173/#/nutrition');await page.getByRole('button',{name:'Log a meal',exact:true}).click()
 const dialog=page.getByRole('dialog');await dialog.getByLabel('Name',{exact:true}).fill(name)
 await dialog.getByLabel('Calories',{exact:true}).fill('120');await dialog.getByRole('button',{name:'Save',exact:true}).click()
 await expect(dialog).not.toBeVisible()
}
async function syncNow(page){
 await page.goto('http://127.0.0.1:5173/#/settings')
 const status=page.getByTestId('sync-status')
 await page.getByRole('button',{name:'Sync now',exact:true}).click()
 await expect(status).toHaveText('Synced to your Drive')
}
test('Google account isolation, Drive restore on a second device, and token-free backup',async({page,browser})=>{
 const cloud=cloudStorage();await mockGoogle(page,cloud);await page.goto('/');await login(page)
 await addMeal(page,'Account A meal');await syncNow(page)
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Export full backup',exact:true}).click()
 const backup=JSON.parse(await readFile(await (await download).path(),'utf8'))
 expect(backup.data.meals[0].name).toBe('Account A meal');expect(JSON.stringify(backup)).not.toContain('mock-access')
 await page.getByRole('button',{name:'Sign out',exact:true}).click()
 await page.goto('http://127.0.0.1:5173/#/nutrition');await expect(page.getByText('Account A meal',{exact:true})).toHaveCount(0)
 await login(page,'user_b');await page.goto('http://127.0.0.1:5173/#/nutrition');await expect(page.getByText('Account A meal',{exact:true})).toHaveCount(0)
 const other=await browser.newContext(),second=await other.newPage();await mockGoogle(second,cloud);await second.goto('http://127.0.0.1:5173/');await login(second)
 await second.goto('http://127.0.0.1:5173/#/nutrition');await expect(second.getByText('Account A meal',{exact:true})).toBeVisible()
 await other.close()
})
test('offline concurrent edits retain both versions and explicitly resolve on both devices',async({page,browser})=>{
 const cloud=cloudStorage();await mockGoogle(page,cloud);await page.goto('/');await login(page)
 await addMeal(page,'Original meal');await syncNow(page)
 const other=await browser.newContext(),second=await other.newPage();await mockGoogle(second,cloud);await second.goto('http://127.0.0.1:5173/');await login(second)
 async function editMeal(p,name){await p.goto('http://127.0.0.1:5173/#/nutrition');await p.locator('.meal-row').getByRole('button',{name:'Edit',exact:true}).click();const dialog=p.getByRole('dialog');await dialog.getByLabel('Name',{exact:true}).fill(name);await dialog.getByRole('button',{name:'Save',exact:true}).click();await expect(dialog).not.toBeVisible()}
 await page.context().setOffline(true);await editMeal(page,'Offline version')
 await editMeal(second,'Other device version');await syncNow(second)
 await page.context().setOffline(false);await page.goto('http://127.0.0.1:5173/#/settings')
 await expect(page.getByTestId('sync-status')).toHaveText('Conflicts need review')
 await expect(page.getByText('Offline version',{exact:false})).toBeVisible()
 await page.locator('.sync-versions section').filter({hasText:'Other device version'}).getByRole('button',{name:'Use this version',exact:true}).click()
 await expect(page.getByTestId('sync-status')).toHaveText('Synced to your Drive')
 await syncNow(second);await second.goto('http://127.0.0.1:5173/#/nutrition');await expect(second.getByText('Other device version',{exact:true})).toBeVisible()
 await other.close()
})
test('expired authorization keeps pending data until the same account reconnects',async({page})=>{
 const cloud=cloudStorage();await mockGoogle(page,cloud);await page.goto('/');await login(page)
 await addMeal(page,'Kept after expiry');cloud.reject=true
 await page.goto('http://127.0.0.1:5173/#/settings');await page.getByRole('button',{name:'Sync now',exact:true}).click()
 await expect(page.getByTestId('sync-status')).toHaveText('Google authorization required')
 cloud.reject=false
 await page.getByRole('button',{name:'Reconnect Google Drive',exact:true}).click()
 await expect(page.getByTestId('sync-status')).toHaveText('Synced to your Drive')
 await page.reload();await login(page);await page.goto('http://127.0.0.1:5173/#/nutrition');await expect(page.getByText('Kept after expiry',{exact:true})).toBeVisible()
})
