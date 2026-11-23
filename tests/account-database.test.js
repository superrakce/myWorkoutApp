import 'fake-indexeddb/auto'
import {it,expect} from 'vitest'
import {readData,writeData,readWorkspace,writeWorkspace} from '../src/repositories/database.js'
it('keeps anonymous and Google account data in separate IndexedDB keys',async()=>{
 await writeData({name:'guest'})
 await writeData({name:'A'},'google:account_a')
 await writeData({name:'B'},'google:account_b')
 expect(await readData()).toEqual({name:'guest'})
 expect(await readData('google:account_a')).toEqual({name:'A'})
 expect(await readData('google:account_b')).toEqual({name:'B'})
})
it('stores business data and outbox checkpoints atomically without credentials',async()=>{
 const workspace={data:{name:'current'},sync:{events:[{id:'revision_0001'}],pending:['revision_0001']}}
 await writeWorkspace('google:checkpoint',workspace)
 expect(await readWorkspace('google:checkpoint')).toMatchObject(workspace)
})

it('rejects stale writes from another tab without overwriting either saved record',async()=>{
 const key='google:two_tabs'
 await writeWorkspace(key,{data:{name:'initial'}},0)
 const first=await readWorkspace(key),second=await readWorkspace(key)
 await writeWorkspace(key,{data:{name:'first tab saved'}},first.revision)
 await expect(writeWorkspace(key,{data:{name:'stale second tab'}},second.revision)).rejects.toThrow('syncLocalChanged')
 expect((await readWorkspace(key)).data.name).toBe('first tab saved')
})
