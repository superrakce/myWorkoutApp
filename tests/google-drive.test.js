import {it,expect,vi} from 'vitest'
import {createDriveClient} from '../src/services/googleDrive.js'
import {FORMAT} from '../src/services/syncGraph.js'
const event={format:FORMAT,id:'revision_000001',key:'profile',parents:[],deleted:false,value:{age:30}}
const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body})
it('requests only appDataFolder with authorization in the header',async()=>{
 const fetcher=vi.fn(async()=>response({files:[]})),drive=createDriveClient({getToken:()=> 'token-private',fetcher})
 await drive.download();const [url,options]=fetcher.mock.calls[0]
 expect(new URL(url).searchParams.get('spaces')).toBe('appDataFolder');expect(url).not.toContain('token-private')
 expect(options.headers.Authorization).toBe('Bearer token-private')
})
it('downloads paginated revisions and does not re-fetch cached immutable data',async()=>{
 const fetcher=vi.fn(async url=>url.includes('alt=media')?response(event):url.includes('pageToken=next')?response({files:[{id:'file_b',md5Checksum:'b'}]}):response({files:[{id:'file_a',md5Checksum:'a'}],nextPageToken:'next'}))
 const result=await createDriveClient({getToken:()=> 't',fetcher}).download({file_a:'a'})
 expect(result.events).toEqual([event]);expect(result.files).toEqual({file_a:'a',file_b:'b'});expect(fetcher).toHaveBeenCalledTimes(3)
})
it('stops when previously known cloud files disappeared',async()=>{
 const drive=createDriveClient({getToken:()=> 't',fetcher:async()=>response({files:[]})})
 await expect(drive.download({missing:'hash'})).rejects.toThrow('syncCloudMissing')
 expect((await drive.download({missing:'hash'},true)).files).toEqual({})
})
it('uploads immutable JSON with the App tag and appDataFolder parent',async()=>{
 const fetcher=vi.fn(async()=>response({id:'file_new',md5Checksum:'new'})),drive=createDriveClient({getToken:()=> 't',fetcher})
 expect(await drive.upload(event)).toEqual({id:'file_new',stamp:'new'})
 expect(fetcher.mock.calls[0][1].body).toContain('"parents":["appDataFolder"]')
 expect(fetcher.mock.calls[0][1].body).toContain(event.id)
})
it.each([[401,'syncNeedsAuth'],[403,'syncPermission'],[429,'syncQuota'],[500,'syncTemporary']])('classifies HTTP %s without deleting local records',async(status,key)=>{
 const drive=createDriveClient({getToken:()=> 't',fetcher:async()=>response({},status)})
 await expect(drive.download()).rejects.toThrow(key)
})
it('does not misclassify an expired in-memory credential as a network error',async()=>{
 const drive=createDriveClient({getToken:()=>{throw Error('syncNeedsAuth')},fetcher:vi.fn()})
 await expect(drive.download()).rejects.toThrow('syncNeedsAuth')
})
it('only deletes files returned from its app-specific listing',async()=>{
 const calls=[],drive=createDriveClient({getToken:()=> 't',fetcher:async(url,options)=>{calls.push([url,options]);return response(options.method==='DELETE'?null:{files:[{id:'app_owned'}]},options.method==='DELETE'?204:200)}})
 await drive.deleteCloud();expect(calls).toHaveLength(2);expect(calls[1][0]).toContain('/files/app_owned');expect(calls[1][1].method).toBe('DELETE')
})
