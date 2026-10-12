import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Modal, ScrollView, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { ThemeText as Text } from '../components/ThemePrimitives';
import { useTheme } from './ThemeContext';
import { LiverpoolWatermark } from '../components/LiverpoolWatermark';
import { ArsenalWatermark } from '../components/ArsenalWatermark';
import SettingsScreen from '../screens/SettingsScreen';

type MenuApi={settingsRevision:number;openMenu:(navigation:any)=>void;openSettings:(params?:{redcoinsImport?:boolean})=>void};
const AppMenu=createContext<MenuApi>({settingsRevision:0,openMenu:()=>{},openSettings:()=>{}});
export const useAppMenu=()=>useContext(AppMenu);
export function AppMenuButton() {
  const {palette:p}=useTheme(),menu=useAppMenu(),navigation=useNavigation();
  return <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open LeanLog menu" onPress={()=>menu.openMenu(navigation)} style={{height:40,width:40,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:p.surfaceAlt}}><Ionicons name="menu" size={25} color={p.text}/></TouchableOpacity>;
}
export function AppMenuProvider({children}:{children:React.ReactNode}) {
  const {palette:p}=useTheme();
  const [page,setPage]=useState<'menu'|'settings'|null>(null),[params,setParams]=useState<{redcoinsImport?:boolean}>({});
  const [settingsRevision,setSettingsRevision]=useState(0);
  const navigation=useRef<any>(null),motion=useRef(new Animated.Value(0)).current,reduceMotion=useRef(false);
  useEffect(()=>{void AccessibilityInfo.isReduceMotionEnabled().then(v=>{reduceMotion.current=v;}).catch(()=>{});const listener=AccessibilityInfo.addEventListener('reduceMotionChanged',v=>{reduceMotion.current=v;});return ()=>listener.remove();},[]);
  useEffect(()=>{motion.setValue(0);const animation=Animated.timing(motion,{toValue:1,duration:reduceMotion.current?0:260,useNativeDriver:true});animation.start();return ()=>animation.stop();},[page,motion]);
  const close=()=>{if(page==='settings')setSettingsRevision(v=>v+1);setPage(null);};
  const openSettings=(next:{redcoinsImport?:boolean}={})=>{setParams(next);setPage('settings');};
  const visit=(route:string)=>{close();navigation.current?.navigate(route);};
  return <AppMenu.Provider value={{settingsRevision,openMenu:nav=>{navigation.current=nav;setPage('menu');},openSettings}}>{children}
    <Modal visible={page!==null} transparent animationType="fade" onRequestClose={close}>
      {page==='settings'?<View style={{flex:1,backgroundColor:p.canvas}}><SettingsScreen menuParams={params} onClose={close}/></View>:<View style={{flex:1,flexDirection:'row',backgroundColor:'rgba(0,0,0,0.45)'}}>
        <Animated.View style={{width:'82%',maxWidth:360,backgroundColor:p.canvas,transform:[{translateX:motion.interpolate({inputRange:[0,1],outputRange:[-360,0]})}]}}><SafeAreaView style={{flex:1}}>{p.id==='arsenal' && <ArsenalWatermark colour={p.accent} width={260}/>} {p.id==='liverpool' && <LiverpoolWatermark colour={p.accent} height={190}/>}<ScrollView contentContainerStyle={{padding:20}}>
          <View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',marginBottom:28}}><View><Text style={{fontSize:28,fontWeight:'800'}}>LeanLog</Text><Text style={{color:p.muted,marginTop:4}}>Your day, your way.</Text></View><TouchableOpacity accessibilityLabel="Close menu" onPress={close} style={{padding:12}}><Ionicons name="close" color={p.text} size={24}/></TouchableOpacity></View>
          {([{route:'Home',label:'Home',icon:'home-outline'},{route:'Log',label:'Log',icon:'restaurant-outline'},{route:'Progress',label:'Progress',icon:'bar-chart-outline'},{route:'Coach',label:'Coach',icon:'leaf-outline'},{route:'RedCoins',label:'RedCoins',icon:'wallet-outline'}] as const).map(item=><TouchableOpacity key={item.route} onPress={()=>visit(item.route)} style={{flexDirection:'row',alignItems:'center',gap:14,paddingVertical:16}}><Ionicons name={item.icon} size={22} color={p.text}/><Text style={{fontSize:16,fontWeight:'600'}}>{item.label}</Text></TouchableOpacity>)}
          <View style={{height:1,backgroundColor:p.border,marginVertical:12}}/>
          <TouchableOpacity accessibilityRole="button" onPress={()=>openSettings()} style={{flexDirection:'row',alignItems:'center',gap:14,padding:16,borderRadius:16,backgroundColor:p.surfaceAlt}}><Ionicons name="settings-outline" size={22} color={p.text}/><Text style={{fontSize:16,fontWeight:'700',flex:1}}>Settings</Text><Ionicons name="chevron-forward" size={18} color={p.text}/></TouchableOpacity>
        </ScrollView></SafeAreaView></Animated.View>
        <TouchableOpacity accessibilityLabel="Dismiss menu" style={{flex:1}} onPress={close}/>
      </View>}
    </Modal>
  </AppMenu.Provider>;
}
