import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Files from 'expo-file-system/legacy';
import type { ActivityEntry } from '../types';
import { cleanActivityDetails } from './activityDetails';
import { normalizeActivityDate, normalizeActivityTime } from './activityDateTime';

let queue: Promise<unknown> = Promise.resolve();
function serial<T>(work:()=>Promise<T>):Promise<T> {
  const next=queue.then(work,work);queue=next.catch(()=>{});return next;
}
export function saveActivityRecord(draft:ActivityEntry) {
  return serial(()=>persistActivityRecord(draft));
}
async function persistActivityRecord(draft:ActivityEntry) {
  if(!draft.name.trim() || !Number.isFinite(draft.duration) || draft.duration<=0 || !Number.isFinite(draft.caloriesBurned) || draft.caloriesBurned<0) throw Error('Enter a name, positive duration and valid calories.');
  const entry={...draft,name:draft.name.trim(),date:normalizeActivityDate(draft.date),time:normalizeActivityTime(draft.time),details:cleanActivityDetails(draft.details)};
  if(draft.imageUri) {
    if(!Files.documentDirectory) throw Error('Screenshot storage is unavailable. Try again.');
    const directory=`${Files.documentDirectory}activity-screenshots/`;
    await Files.makeDirectoryAsync(directory,{intermediates:true});
    const target=`${directory}${draft.id.replace(/[^A-Za-z0-9_-]/g,'_')}.jpg`;
    if(draft.imageUri!==target) await Files.copyAsync({from:draft.imageUri,to:target});
    entry.imageUri=target;
  }
  const raw=await AsyncStorage.getItem('activity_entries');
  const rows:ActivityEntry[]=raw?JSON.parse(raw):[];
  const next=[entry,...rows.filter(row=>row.id!==entry.id)];
  await AsyncStorage.setItem('activity_entries',JSON.stringify(next));
  const stored:ActivityEntry[]=JSON.parse(await AsyncStorage.getItem('activity_entries')||'[]');
  if(!stored.some(row=>row.id===entry.id))throw Error('Activity could not be confirmed in local storage. Please retry.');
  return {entry,rows:next};
}
export function removeActivityRecord(id:string) {
  return serial(async()=>{
    const rows:ActivityEntry[]=JSON.parse(await AsyncStorage.getItem('activity_entries')||'[]');
    const next=rows.filter(row=>row.id!==id);
    await AsyncStorage.setItem('activity_entries',JSON.stringify(next));return next;
  });
}
