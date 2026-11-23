import { validateEvent, mergeEvents } from './syncGraph.js'
const TAG='form-workout-sync-v1'
export class DriveError extends Error {constructor(key,status=0){super(key);this.status=status}}
export function createDriveClient({getToken,fetcher=(...args)=>fetch(...args),signal}){
  async function request(path,options={}){
    let response
    const token=getToken()
    try{response=await fetcher('https://www.googleapis.com/'+path,{...options,signal,headers:{...options.headers,Authorization:'Bearer '+token}})}
    catch(error){if(error.name==='AbortError')throw error;throw new DriveError('syncNetwork')}
    if(!response.ok){
      if(response.status===401)throw new DriveError('syncNeedsAuth',401)
      if(response.status===403){const body=await response.json().catch(()=>({}));const reason=body.error?.errors?.[0]?.reason;throw new DriveError(['rateLimitExceeded','userRateLimitExceeded','dailyLimitExceeded'].includes(reason)?'syncQuota':'syncPermission',403)}
      if(response.status===429)throw new DriveError('syncQuota',429)
      if(response.status===404)throw new DriveError('syncCloudMissing',404)
      throw new DriveError(response.status>=500?'syncTemporary':'syncRequestFailed',response.status)
    }
    if(response.status===204)return null
    return response.json()
  }
  async function list(){
    const files=[];let pageToken
    do{
      const query=new URLSearchParams({spaces:'appDataFolder',q:"trashed = false and appProperties has { key='formApp' and value='"+TAG+"' }",pageSize:'100',fields:'nextPageToken,files(id,name,md5Checksum,size)'})
      if(pageToken)query.set('pageToken',pageToken)
      const page=await request('drive/v3/files?'+query)
      if(!Array.isArray(page.files))throw new DriveError('syncCorrupt')
      files.push(...page.files);pageToken=page.nextPageToken
      if(files.length>50000)throw new DriveError('syncTooLarge')
    }while(pageToken)
    return files
  }
  async function read(file){
    if(Number(file.size||0)>2*1024*1024)throw new DriveError('syncTooLarge')
    return validateEvent(await request('drive/v3/files/'+encodeURIComponent(file.id)+'?alt=media'))
  }
  async function download(knownFiles={},allowMissing=false){
    const files=await list(),ids=new Set(files.map(f=>f.id))
    if(!allowMissing&&Object.keys(knownFiles).some(id=>!ids.has(id)))throw new DriveError('syncCloudMissing')
    const incoming=[],index={}
    let cursor=0
    async function worker(){
      while(cursor<files.length){
        const file=files[cursor++],stamp=file.md5Checksum||file.id
        index[file.id]=stamp
        if(knownFiles[file.id]!==stamp)incoming.push(await read(file))
      }
    }
    await Promise.all(Array.from({length:Math.min(4,files.length)},worker))
    return {events:incoming,files:index}
  }
  async function upload(event){
    validateEvent(event)
    const boundary='form_'+crypto.randomUUID()
    const metadata={name:event.id+'.json',parents:['appDataFolder'],mimeType:'application/json',appProperties:{formApp:TAG,revision:event.id}}
    const body='--'+boundary+'\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n'+JSON.stringify(metadata)+'\r\n--'+boundary+'\r\nContent-Type: application/json\r\n\r\n'+JSON.stringify(event)+'\r\n--'+boundary+'--'
    const file=await request('upload/drive/v3/files?uploadType=multipart&fields=id,md5Checksum',{method:'POST',headers:{'Content-Type':'multipart/related; boundary='+boundary},body})
    if(!file?.id)throw new DriveError('syncCorrupt')
    return {id:file.id,stamp:file.md5Checksum||file.id}
  }
  async function deleteCloud(){
    const files=await list()
    for(const file of files)await request('drive/v3/files/'+encodeURIComponent(file.id),{method:'DELETE'})
  }
  return {download,upload,deleteCloud}
}
