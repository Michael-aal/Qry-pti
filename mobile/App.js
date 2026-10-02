import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, Linking, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as ScreenCapture from "expo-screen-capture";
import { WebView } from "react-native-webview";

const HOME_URL = "https://www.google.com";
const TRACKER_HOSTS = ["google-analytics.com","googletagmanager.com","doubleclick.net","googlesyndication.com","adservice.google.com","connect.facebook.net","hotjar.com","clarity.ms","segment.io","mixpanel.com"];
const PERMISSION_KEYS = ["camera","microphone","location","notifications"];

function normalizeUrl(value) {
  const input = value.trim();
  if (!input) return HOME_URL;
  try {
    const parsed = new URL(input);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href;
  } catch {}
  return "https://www.google.com/search?q=" + encodeURIComponent(input);
}
function isTracker(url) {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return TRACKER_HOSTS.some((host) => hostname === host || hostname.endsWith("." + host));
  } catch { return false; }
}

export default function App() {
  const [tabs,setTabs]=useState([{id:"tab-1",url:HOME_URL,title:"New tab",private:false}]);
  const [activeId,setActiveId]=useState("tab-1");
  const [address,setAddress]=useState(HOME_URL);
  const [loading,setLoading]=useState(false);
  const [canBack,setCanBack]=useState(false);
  const [canForward,setCanForward]=useState(false);
  const [showPanel,setShowPanel]=useState(false);
  const [panel,setPanel]=useState("tabs");
  const [bookmarks,setBookmarks]=useState([]);
  const [history,setHistory]=useState([]);
  const [downloads,setDownloads]=useState([]);
  const [privateMode,setPrivateMode]=useState(false);
  const [privacy,setPrivacy]=useState({blockTrackers:true,blockThirdPartyCookies:true,fingerprintProtection:true,screenProtection:true});
  const [permissions,setPermissions]=useState({camera:false,microphone:false,location:false,notifications:false});
  const [sitePermissions,setSitePermissions]=useState({});
  const [dark,setDark]=useState(true);
  const webviews=useRef({});
  const activeTab=tabs.find((t)=>t.id===activeId)||tabs[0];
  const host=(()=>{try{return new URL(activeTab.url).hostname}catch{return ""}})();

  useEffect(()=>{(async()=>{try{
    const [p,b,h,d,perm,sp]=await Promise.all([
      AsyncStorage.getItem("qrypti_privacy"),AsyncStorage.getItem("qrypti_bookmarks"),AsyncStorage.getItem("qrypti_history"),
      AsyncStorage.getItem("qrypti_downloads"),AsyncStorage.getItem("qrypti_permissions"),AsyncStorage.getItem("qrypti_site_permissions")
    ]);
    if(p)setPrivacy((x)=>({...x,...JSON.parse(p)})); if(b)setBookmarks(JSON.parse(b)); if(h)setHistory(JSON.parse(h)); if(d)setDownloads(JSON.parse(d));
    if(perm)setPermissions((x)=>({...x,...JSON.parse(perm)})); if(sp)setSitePermissions(JSON.parse(sp));
    await SecureStore.getItemAsync("qrypti_session").catch(()=>null);
  }catch{}})()},[]);

  useEffect(()=>{(async()=>{try{if(privacy.screenProtection)await ScreenCapture.preventScreenCaptureAsync("qrypti");else await ScreenCapture.allowScreenCaptureAsync("qrypti")}catch{}})();return()=>{ScreenCapture.allowScreenCaptureAsync("qrypti").catch(()=>{})}},[privacy.screenProtection]);

  useEffect(()=>{const sub=BackHandler.addEventListener("hardwareBackPress",()=>{if(canBack){webviews.current[activeId]?.goBack();return true}return false});return()=>sub.remove()},[activeId,canBack]);

  const updateTab=(id,patch)=>setTabs((x)=>x.map((t)=>t.id===id?{...t,...patch}:t));
  const open=(value)=>{const next=normalizeUrl(value);updateTab(activeId,{url:next,title:next});setAddress(next)};
  const newTab=(isPrivate=privateMode)=>{const id="tab-"+Date.now();setTabs((x)=>[...x,{id,url:HOME_URL,title:"New tab",private:isPrivate}]);setActiveId(id);setAddress(HOME_URL);setCanBack(false);setCanForward(false);setShowPanel(false)};
  const closeTab=(id)=>setTabs((x)=>{if(x.length===1)return x;const i=x.findIndex((t)=>t.id===id);const rest=x.filter((t)=>t.id!==id);if(id===activeId){const n=rest[Math.max(0,i-1)];setActiveId(n.id);setAddress(n.url)}delete webviews.current[id];return rest});
  const toggle=async(key)=>{const next={...privacy,[key]:!privacy[key]};setPrivacy(next);await AsyncStorage.setItem("qrypti_privacy",JSON.stringify(next))};
  const saveHistory=async(page)=>{if(activeTab?.private)return;const next=[{url:page,at:Date.now()},...history.filter((x)=>x.url!==page)].slice(0,200);setHistory(next);await AsyncStorage.setItem("qrypti_history",JSON.stringify(next))};
  const addBookmark=async()=>{const item={url:activeTab.url,title:activeTab.title||activeTab.url,at:Date.now()};if(bookmarks.some((b)=>b.url===item.url)){Alert.alert("Bookmark","Already bookmarked.");return}const next=[item,...bookmarks].slice(0,500);setBookmarks(next);await AsyncStorage.setItem("qrypti_bookmarks",JSON.stringify(next))};
  const removeBookmark=async(url)=>{const next=bookmarks.filter((b)=>b.url!==url);setBookmarks(next);await AsyncStorage.setItem("qrypti_bookmarks",JSON.stringify(next))};
  const addDownload=async(url)=>{const next=[{url,at:Date.now()},...downloads].slice(0,100);setDownloads(next);await AsyncStorage.setItem("qrypti_downloads",JSON.stringify(next));Linking.openURL(url).catch(()=>Alert.alert("Download","Android could not open the download."))};
  const setPermission=async(key)=>{const next={...permissions,[key]:!permissions[key]};setPermissions(next);await AsyncStorage.setItem("qrypti_permissions",JSON.stringify(next))};
  const setSitePermission=async(key)=>{const current=sitePermissions[host]||{};const next={...sitePermissions,[host]:{...current,[key]:!current[key]}};setSitePermissions(next);await AsyncStorage.setItem("qrypti_site_permissions",JSON.stringify(next))};
  const clearHistory=async()=>{setHistory([]);await AsyncStorage.removeItem("qrypti_history")};
  const clearData=async()=>{await clearHistory();setBookmarks([]);setDownloads([]);await AsyncStorage.multiRemove(["qrypti_bookmarks","qrypti_downloads"]);Alert.alert("Browser data","History, bookmarks and download records cleared.")};

  const renderPanel=()=> {
    if(!showPanel)return null;
    if(panel==="tabs")return <View style={styles.panel}><View style={styles.panelHead}><Text style={styles.panelTitle}>Tabs ({tabs.length})</Text><TouchableOpacity onPress={()=>newTab(false)}><Text style={styles.action}>New tab</Text></TouchableOpacity></View>{tabs.map(t=><View key={t.id} style={styles.row}><TouchableOpacity style={styles.rowMain} onPress={()=>{setActiveId(t.id);setShowPanel(false)}}><Text style={styles.rowTitle} numberOfLines={1}>{t.private?"Private • ":""}{t.title}</Text><Text style={styles.rowSub} numberOfLines={1}>{t.url}</Text></TouchableOpacity>{tabs.length>1&&<TouchableOpacity onPress={()=>closeTab(t.id)}><Text style={styles.close}>×</Text></TouchableOpacity>}</View>)}<View style={styles.panelActions}><TouchableOpacity onPress={()=>setPanel("bookmarks")}><Text style={styles.action}>Bookmarks</Text></TouchableOpacity><TouchableOpacity onPress={()=>setPanel("history")}><Text style={styles.action}>History</Text></TouchableOpacity><TouchableOpacity onPress={()=>setPanel("downloads")}><Text style={styles.action}>Downloads</Text></TouchableOpacity></View></View>;
    if(panel==="bookmarks")return <View style={styles.panel}><View style={styles.panelHead}><Text style={styles.panelTitle}>Bookmarks</Text><TouchableOpacity onPress={()=>setPanel("tabs")}><Text style={styles.action}>Tabs</Text></TouchableOpacity></View><ScrollView>{bookmarks.map(b=><View key={b.url} style={styles.row}><TouchableOpacity style={styles.rowMain} onPress={()=>{open(b.url);setShowPanel(false)}}><Text style={styles.rowTitle} numberOfLines={1}>{b.title}</Text><Text style={styles.rowSub} numberOfLines={1}>{b.url}</Text></TouchableOpacity><TouchableOpacity onPress={()=>removeBookmark(b.url)}><Text style={styles.close}>×</Text></TouchableOpacity></View>)}</ScrollView></View>;
    if(panel==="history")return <View style={styles.panel}><View style={styles.panelHead}><Text style={styles.panelTitle}>History</Text><TouchableOpacity onPress={clearHistory}><Text style={styles.action}>Clear</Text></TouchableOpacity></View><ScrollView>{history.map(h=><TouchableOpacity key={h.url+h.at} style={styles.historyRow} onPress={()=>{open(h.url);setShowPanel(false)}}><Text style={styles.rowTitle} numberOfLines={1}>{h.url}</Text></TouchableOpacity>)}</ScrollView></View>;
    if(panel==="downloads")return <View style={styles.panel}><View style={styles.panelHead}><Text style={styles.panelTitle}>Downloads</Text><TouchableOpacity onPress={()=>setPanel("tabs")}><Text style={styles.action}>Tabs</Text></TouchableOpacity></View><ScrollView>{downloads.map(d=><TouchableOpacity key={d.url+d.at} style={styles.historyRow} onPress={()=>Linking.openURL(d.url).catch(()=>{})}><Text style={styles.rowTitle} numberOfLines={1}>{d.url}</Text></TouchableOpacity>)}</ScrollView></View>;
    return <View style={styles.panel}><View style={styles.panelHead}><Text style={styles.panelTitle}>Settings</Text><TouchableOpacity onPress={()=>setShowPanel(false)}><Text style={styles.action}>Done</Text></TouchableOpacity></View>
      <Text style={styles.section}>Protection</Text>
      {[["blockTrackers","Tracker blocking"],["blockThirdPartyCookies","Third-party cookies"],["fingerprintProtection","Fingerprint*"],["screenProtection","Screen capture"]].map(([k,l])=><TouchableOpacity key={k} style={styles.settingRow} onPress={()=>toggle(k)}><Text style={styles.rowTitle}>{l}</Text><Text style={styles.settingValue}>{privacy[k]?"ON":"OFF"}</Text></TouchableOpacity>)}
      <Text style={styles.section}>Site permissions: {host||"current site"}</Text>
      {PERMISSION_KEYS.map(k=><TouchableOpacity key={k} style={styles.settingRow} onPress={()=>setSitePermission(k)}><Text style={styles.rowTitle}>{k}</Text><Text style={styles.settingValue}>{sitePermissions[host]?.[k]?"ON":"OFF"}</Text></TouchableOpacity>)}
      <Text style={styles.section}>Browser</Text>
      <TouchableOpacity style={styles.settingRow} onPress={()=>setPrivateMode((x)=>!x)}><Text style={styles.rowTitle}>Private mode for new tabs</Text><Text style={styles.settingValue}>{privateMode?"ON":"OFF"}</Text></TouchableOpacity>
      <TouchableOpacity style={styles.settingRow} onPress={clearData}><Text style={styles.rowTitle}>Clear browser data</Text><Text style={styles.settingValue}>CLEAR</Text></TouchableOpacity>
      <Text style={styles.note}>Fingerprint protection is best-effort in WebView. Screen protection applies to QRY-PTI itself, not other apps.</Text>
    </View>;
  };

  return <SafeAreaView style={styles.root}>
    <StatusBar barStyle="light-content" backgroundColor="#09090b"/>
    <View style={styles.header}><TouchableOpacity onPress={()=>{setPanel("tabs");setShowPanel((x)=>!x)}}><Text style={styles.brand}>QRY-PTI</Text></TouchableOpacity><Text style={styles.secure}>{activeTab?.private?"PRIVATE TAB":"PRIVATE BROWSER"}</Text><View style={styles.spacer}/><TouchableOpacity style={styles.iconBtn} onPress={addBookmark}><Text style={styles.icon}>☆</Text></TouchableOpacity><TouchableOpacity style={styles.iconBtn} onPress={()=>newTab(false)}><Text style={styles.icon}>＋</Text></TouchableOpacity><TouchableOpacity style={styles.iconBtn} onPress={()=>{setPanel("settings");setShowPanel(true)}}><Text style={styles.icon}>☰</Text></TouchableOpacity></View>
    {renderPanel()}
    <View style={styles.addressRow}><TouchableOpacity style={styles.navBtn} disabled={!canBack} onPress={()=>webviews.current[activeId]?.goBack()}><Text style={[styles.nav,!canBack&&styles.disabled]}>‹</Text></TouchableOpacity><TouchableOpacity style={styles.navBtn} disabled={!canForward} onPress={()=>webviews.current[activeId]?.goForward()}><Text style={[styles.nav,!canForward&&styles.disabled]}>›</Text></TouchableOpacity><TextInput value={address} onChangeText={setAddress} onSubmitEditing={()=>open(address)} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="Search or enter address" placeholderTextColor="#71717a" style={styles.address}/><TouchableOpacity style={styles.go} onPress={()=>open(address)}><Text style={styles.goText}>Go</Text></TouchableOpacity></View>
    <View style={styles.protectBar}><Text style={styles.protectTitle}>Protection</Text>{[["blockTrackers","Trackers"],["blockThirdPartyCookies","Cookies"],["fingerprintProtection","Fingerprint*"],["screenProtection","Screen"]].map(([k,l])=><TouchableOpacity key={k} style={[styles.pill,privacy[k]&&styles.pillOn]} onPress={()=>toggle(k)}><Text style={styles.pillText}>{privacy[k]?"ON ":"OFF "}{l}</Text></TouchableOpacity>)}</View>
    <View style={styles.web}><ScrollView contentContainerStyle={styles.webScroll}>{tabs.map(t=><View key={t.id} style={[styles.layer,t.id!==activeId&&styles.hidden]}><WebView ref={(r)=>{if(r)webviews.current[t.id]=r}} source={{uri:t.url}} onLoadStart={()=>t.id===activeId&&setLoading(true)} onLoadEnd={()=>t.id===activeId&&setLoading(false)} onNavigationStateChange={(s)=>{if(t.id!==activeId)return;setAddress(s.url);setCanBack(s.canGoBack);setCanForward(s.canGoForward);updateTab(t.id,{url:s.url,title:s.title||s.url});saveHistory(s.url)}} onShouldStartLoadWithRequest={(r)=>{if(r.url.startsWith("http://")||r.url.startsWith("https://"))return !(privacy.blockTrackers&&isTracker(r.url));Linking.openURL(r.url).catch(()=>{});return false}} onFileDownload={(e)=>addDownload(e.nativeEvent.downloadUrl)} javaScriptEnabled domStorageEnabled mediaPlaybackRequiresUserAction={false} allowsFullscreenVideo thirdPartyCookiesEnabled={!privacy.blockThirdPartyCookies} sharedCookiesEnabled={false} allowsBackForwardNavigationGestures startInLoadingState setSupportMultipleWindows={false} mixedContentMode="never" style={styles.webview}/></View>)}</ScrollView>{loading&&<View style={styles.loader}><ActivityIndicator/></View>}</View>
    <View style={styles.bottom}><TouchableOpacity onPress={()=>open(HOME_URL)}><Text style={styles.bottomText}>Home</Text></TouchableOpacity><TouchableOpacity onPress={()=>webviews.current[activeId]?.reload()}><Text style={styles.bottomText}>Reload</Text></TouchableOpacity><TouchableOpacity onPress={()=>{setPanel("tabs");setShowPanel(true)}}><Text style={styles.bottomText}>Tabs {tabs.length}</Text></TouchableOpacity><TouchableOpacity onPress={()=>{const n=!privateMode;setPrivateMode(n);Alert.alert("Private mode",n?"New tabs will not save history.":"New tabs will be normal.")}}><Text style={styles.bottomText}>{privateMode?"Private ON":"Private"}</Text></TouchableOpacity></View>
  </SafeAreaView>;
}

const styles=StyleSheet.create({
root:{flex:1,backgroundColor:"#09090b"},header:{height:50,paddingHorizontal:12,flexDirection:"row",alignItems:"center",gap:7},brand:{color:"#fff",fontSize:18,fontWeight:"800"},secure:{color:"#71717a",fontSize:9,letterSpacing:1},spacer:{flex:1},iconBtn:{width:34,height:34,borderRadius:9,alignItems:"center",justifyContent:"center",backgroundColor:"#18181b"},icon:{color:"#fff",fontSize:18},panel:{maxHeight:330,padding:10,backgroundColor:"#111113",borderBottomWidth:1,borderBottomColor:"#27272a"},panelHead:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:7},panelTitle:{color:"#fff",fontSize:14,fontWeight:"800"},action:{color:"#d4d4d8",fontSize:12,fontWeight:"700"},row:{flexDirection:"row",alignItems:"center",padding:8,borderRadius:8,backgroundColor:"#18181b",marginBottom:5},rowMain:{flex:1},rowTitle:{color:"#fff",fontSize:12,fontWeight:"600"},rowSub:{color:"#71717a",fontSize:10,marginTop:2},close:{color:"#fff",fontSize:22,paddingHorizontal:8},panelActions:{flexDirection:"row",justifyContent:"space-around",paddingTop:8},historyRow:{padding:9,borderBottomWidth:1,borderBottomColor:"#27272a"},section:{color:"#a1a1aa",fontSize:10,marginTop:10,marginBottom:4,textTransform:"uppercase",letterSpacing:1},settingRow:{flexDirection:"row",justifyContent:"space-between",paddingVertical:9,borderBottomWidth:1,borderBottomColor:"#27272a"},settingValue:{color:"#fff",fontSize:11,fontWeight:"800"},note:{color:"#71717a",fontSize:10,lineHeight:15,marginTop:10},addressRow:{flexDirection:"row",alignItems:"center",padding:8,gap:6,backgroundColor:"#18181b"},navBtn:{width:36,height:38,borderRadius:10,alignItems:"center",justifyContent:"center",backgroundColor:"#27272a"},nav:{color:"#fff",fontSize:26},disabled:{color:"#52525b"},address:{flex:1,height:38,borderRadius:10,paddingHorizontal:12,color:"#fff",backgroundColor:"#27272a"},go:{height:38,paddingHorizontal:13,borderRadius:10,justifyContent:"center",backgroundColor:"#fff"},goText:{color:"#09090b",fontWeight:"700"},protectBar:{minHeight:46,paddingHorizontal:7,paddingVertical:6,flexDirection:"row",alignItems:"center",gap:5,backgroundColor:"#09090b"},protectTitle:{color:"#a1a1aa",fontSize:10},pill:{borderWidth:1,borderColor:"#3f3f46",borderRadius:999,paddingHorizontal:8,paddingVertical:5},pillOn:{borderColor:"#fff"},pillText:{color:"#d4d4d8",fontSize:9},web:{flex:1,position:"relative",backgroundColor:"#fff"},webScroll:{flexGrow:1},layer:{flex:1},hidden:{display:"none"},webview:{flex:1},loader:{position:"absolute",top:0,left:0,right:0,paddingVertical:5,backgroundColor:"#fff"},bottom:{height:48,paddingHorizontal:18,flexDirection:"row",alignItems:"center",justifyContent:"space-between",backgroundColor:"#18181b"},bottomText:{color:"#d4d4d8",fontSize:11,fontWeight:"700"}
});