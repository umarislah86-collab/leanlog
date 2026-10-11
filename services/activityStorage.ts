import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Files from 'expo-file-system/legacy';
import type { ActivityEntry } from '../types';
import { cleanActivityDetails, validActivityDate } from './activityDetails';

export async function saveActivityRecord(draft:ActivityEntry) {
  if(!draft.name.trim() || !Number.isFinite(draft.duration) || draft.duration<=0 || !Number.isFinite(draft.caloriesBurned) || draft.caloriesBurned<0) throw Error('Enter a name, positive duration and valid calories.');
  if(!validActivityDate(draft.date)||!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(draft.time)) throw Error('Use date D/M/YYYY and time HH:mm.');
  const entry={...draft,name:draft.name.trim(),date:draft.date.split('/').map(Number).join('/'),details:cleanActivityDetails(draft.details)};
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
  return {entry,rows:next};
}
