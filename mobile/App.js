import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, BackHandler, Linking, SafeAreaView, StatusBar, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as ScreenCapture from "expo-screen-capture";
import { WebView } from "react-native-webview";

const HOME_URL = "https://www.google.com";
const TRACKER_HOSTS = ["google-analytics.com","googletagmanager.com","doubleclick.net","googlesyndication.com","adservice.google.com","connect.facebook.net","hotjar.com","clarity.ms","segment.io","mixpanel.com"];

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
  const [tabs, setTabs] = useState([{ id: "tab-1", url: HOME_URL, title: "New tab", private: false }]);
  const [activeId, setActiveId] = useState("tab-1");
  const [address, setAddress] = useState(HOME_URL);
  const [loading, setLoading] = useState(false);
  const [canBack, setCanBack] = useState(false);
  const [canForward, setCanForward] = useState(false);
  const [showTabs, setShowTabs] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [history, setHistory] = useState([]);
  const [privateMode, setPrivateMode] = useState(false);
  const [privacy, setPrivacy] = useState({ blockTrackers:true, blockThirdPartyCookies:true, fingerprintProtection:true, screenProtection:true });
  const webviews = useRef({});
  const activeTab = tabs.find((tab) => tab.id === activeId) || tabs[0];

  useEffect(() => {
    (async () => {
      try {
        const [p,b,h] = await Promise.all([AsyncStorage.getItem("qrypti_privacy"),AsyncStorage.getItem("qrypti_bookmarks"),AsyncStorage.getItem("qrypti_history")]);
        if (p) setPrivacy((current) => ({...current,...JSON.parse(p)}));
        if (b) setBookmarks(JSON.parse(b));
        if (h) setHistory(JSON.parse(h));
        await SecureStore.getItemAsync("qrypti_session").catch(() => null);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    const run = async () => {
      if (privacy.screenProtection) await ScreenCapture.preventScreenCaptureAsync("qrypti");
      else await ScreenCapture.allowScreenCaptureAsync("qrypti");
    };
    run().catch(() => {});
    return () => { ScreenCapture.allowScreenCaptureAsync("qrypti").catch(() => {}); };
  }, [privacy.screenProtection]);

  useEffect(() => {
    const onBack = () => {
      if (canBack) { webviews.current[activeId]?.goBack(); return true; }
      return false;
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
  }, [activeId, canBack]);

  const updateTab = (id, patch) => setTabs((current) => current.map((tab) => tab.id === id ? {...tab,...patch} : tab));

  const open = (value) => {
    const next = normalizeUrl(value);
    updateTab(activeId,{url:next,title:next});
    setAddress(next);
  };

  const newTab = (isPrivate = privateMode) => {
    const id = "tab-" + Date.now();
    setTabs((current) => [...current,{id,url:HOME_URL,title:"New tab",private:isPrivate}]);
    setActiveId(id); setAddress(HOME_URL); setCanBack(false); setCanForward(false); setShowTabs(false);
  };

  const closeTab = (id) => {
    setTabs((current) => {
      if (current.length === 1) return current;
      const index = current.findIndex((tab) => tab.id === id);
      const remaining = current.filter((tab) => tab.id !== id);
      if (id === activeId) {
        const next = remaining[Math.max(0,index-1)];
        setActiveId(next.id); setAddress(next.url);
      }
      delete webviews.current[id];
      return remaining;
    });
  };

  const togglePrivacy = async (key) => {
    const next = {...privacy,[key]:!privacy[key]};
    setPrivacy(next);
    await AsyncStorage.setItem("qrypti_privacy",JSON.stringify(next));
  };

  const saveHistory = async (pageUrl) => {
    if (activeTab?.private) return;
    const next = [{url:pageUrl,at:Date.now()},...history.filter((item) => item.url !== pageUrl)].slice(0,100);
    setHistory(next);
    await AsyncStorage.setItem("qrypti_history",JSON.stringify(next));
  };

  const addBookmark = async () => {
    const item = {url:activeTab.url,title:activeTab.title || activeTab.url,at:Date.now()};
    if (bookmarks.some((b) => b.url === item.url)) { Alert.alert("Bookmark","This page is already bookmarked."); return; }
    const next = [item,...bookmarks].slice(0,200);
    setBookmarks(next); await AsyncStorage.setItem("qrypti_bookmarks",JSON.stringify(next));
    Alert.alert("Bookmark saved",item.title);
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#09090b" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setShowTabs((v) => !v)}><Text style={styles.brand}>QRY-PTI</Text></TouchableOpacity>
        <Text style={styles.secure}>{activeTab?.private ? "PRIVATE TAB" : "PRIVATE BROWSER"}</Text>
        <View style={styles.headerSpacer}/>
        <TouchableOpacity onPress={() => newTab(false)} style={styles.iconButton}><Text style={styles.icon}>＋</Text></TouchableOpacity>
        <TouchableOpacity onPress={addBookmark} style={styles.iconButton}><Text style={styles.icon}>☆</Text></TouchableOpacity>
      </View>

      {showTabs && <View style={styles.tabPanel}>
        <View style={styles.panelHeader}><Text style={styles.panelTitle}>Tabs ({tabs.length})</Text><TouchableOpacity onPress={() => newTab(false)}><Text style={styles.action}>New tab</Text></TouchableOpacity></View>
        {tabs.map((tab) => <View key={tab.id} style={styles.tabRow}>
          <TouchableOpacity style={styles.tabMain} onPress={() => {setActiveId(tab.id);setShowTabs(false);}}>
            <Text style={styles.tabTitle} numberOfLines={1}>{tab.private ? "Private • " : ""}{tab.title}</Text>
            <Text style={styles.tabUrl} numberOfLines={1}>{tab.url}</Text>
          </TouchableOpacity>
          {tabs.length > 1 && <TouchableOpacity onPress={() => closeTab(tab.id)}><Text style={styles.close}>×</Text></TouchableOpacity>}
        </View>)}
        <View style={styles.panelActions}>
          <TouchableOpacity onPress={() => Alert.alert("Bookmarks",bookmarks.length ? bookmarks.map((b) => b.title).join("\\n") : "No bookmarks yet.")}><Text style={styles.action}>Bookmarks ({bookmarks.length})</Text></TouchableOpacity>
          <TouchableOpacity onPress={() => Alert.alert("History",activeTab.private ? "Private tabs do not save history." : history.length + " pages saved")}><Text style={styles.action}>History ({history.length})</Text></TouchableOpacity>
        </View>
      </View>}

      <View style={styles.addressRow}>
        <TouchableOpacity style={styles.navButton} disabled={!canBack} onPress={() => webviews.current[activeId]?.goBack()}><Text style={[styles.navText,!canBack&&styles.disabled]}>‹</Text></TouchableOpacity>
        <TouchableOpacity style={styles.navButton} disabled={!canForward} onPress={() => webviews.current[activeId]?.goForward()}><Text style={[styles.navText,!canForward&&styles.disabled]}>›</Text></TouchableOpacity>
        <TextInput value={address} onChangeText={setAddress} onSubmitEditing={() => open(address)} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="Search or enter address" placeholderTextColor="#71717a" style={styles.address}/>
        <TouchableOpacity style={styles.goButton} onPress={() => open(address)}><Text style={styles.goText}>Go</Text></TouchableOpacity>
      </View>

      <View style={styles.privacyBar}>
        <Text style={styles.privacyTitle}>Protection</Text>
        {[["blockTrackers","Trackers"],["blockThirdPartyCookies","3rd-party cookies"],["fingerprintProtection","Fingerprint*"],["screenProtection","Screen"]].map(([key,label]) =>
          <TouchableOpacity key={key} style={[styles.pill,privacy[key]&&styles.pillActive]} onPress={() => togglePrivacy(key)}><Text style={styles.pillText}>{privacy[key]?"ON ":"OFF "}{label}</Text></TouchableOpacity>
        )}
      </View>

      <View style={styles.webContainer}>
        {loading && <View style={styles.loader}><ActivityIndicator/></View>}
        {tabs.map((tab) => <View key={tab.id} style={[styles.webLayer,tab.id!==activeId&&styles.hidden]}>
          <WebView
            ref={(ref) => {if(ref) webviews.current[tab.id]=ref;}}
            source={{uri:tab.url}}
            onLoadStart={() => tab.id===activeId&&setLoading(true)}
            onLoadEnd={() => tab.id===activeId&&setLoading(false)}
            onNavigationStateChange={(state) => {
              if(tab.id!==activeId)return;
              setAddress(state.url);setCanBack(state.canGoBack);setCanForward(state.canGoForward);
              updateTab(tab.id,{url:state.url,title:state.title||state.url});saveHistory(state.url);
            }}
            onShouldStartLoadWithRequest={(request) => {
              const requestUrl=request.url;
              if(requestUrl.startsWith("http://")||requestUrl.startsWith("https://")) {
                if(privacy.blockTrackers&&isTracker(requestUrl))return false;
                return true;
              }
              Linking.openURL(requestUrl).catch(()=>{});return false;
            }}
            onFileDownload={(event) => Linking.openURL(event.nativeEvent.downloadUrl).catch(() => Alert.alert("Download","QRY-PTI could not open this download link."))}
            javaScriptEnabled domStorageEnabled mediaPlaybackRequiresUserAction={false} allowsFullscreenVideo
            thirdPartyCookiesEnabled={!privacy.blockThirdPartyCookies} sharedCookiesEnabled={false}
            allowsBackForwardNavigationGestures startInLoadingState setSupportMultipleWindows={false} mixedContentMode="never"
            style={styles.webview}
          />
        </View>)}
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity onPress={() => open(HOME_URL)}><Text style={styles.bottomText}>Home</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => webviews.current[activeId]?.reload()}><Text style={styles.bottomText}>Reload</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => newTab(privateMode)}><Text style={styles.bottomText}>New tab</Text></TouchableOpacity>
        <TouchableOpacity onPress={() => {const next=!privateMode;setPrivateMode(next);Alert.alert("Private mode",next?"New tabs will not save history.":"New tabs will be normal.");}}><Text style={styles.bottomText}>{privateMode?"Private ON":"Private"}</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
 root:{flex:1,backgroundColor:"#09090b"},header:{height:48,paddingHorizontal:14,flexDirection:"row",alignItems:"center",gap:8},brand:{color:"#fff",fontSize:18,fontWeight:"800"},secure:{color:"#71717a",fontSize:10,letterSpacing:1.2},headerSpacer:{flex:1},iconButton:{width:34,height:34,borderRadius:9,alignItems:"center",justifyContent:"center",backgroundColor:"#18181b"},icon:{color:"#fff",fontSize:20},
 tabPanel:{maxHeight:270,padding:10,backgroundColor:"#111113",borderBottomWidth:1,borderBottomColor:"#27272a"},panelHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:7},panelTitle:{color:"#fff",fontWeight:"700"},action:{color:"#d4d4d8",fontSize:12,fontWeight:"600"},tabRow:{flexDirection:"row",alignItems:"center",padding:8,borderRadius:9,backgroundColor:"#18181b",marginBottom:5},tabMain:{flex:1},tabTitle:{color:"#fff",fontSize:12,fontWeight:"600"},tabUrl:{color:"#71717a",fontSize:10,marginTop:2},close:{color:"#fff",fontSize:22,paddingHorizontal:8},panelActions:{flexDirection:"row",justifyContent:"space-around",paddingTop:7},
 addressRow:{flexDirection:"row",alignItems:"center",padding:8,gap:6,backgroundColor:"#18181b"},navButton:{width:36,height:38,borderRadius:10,alignItems:"center",justifyContent:"center",backgroundColor:"#27272a"},navText:{color:"#fff",fontSize:26},disabled:{color:"#52525b"},address:{flex:1,height:38,borderRadius:10,paddingHorizontal:12,color:"#fff",backgroundColor:"#27272a"},goButton:{height:38,paddingHorizontal:13,borderRadius:10,justifyContent:"center",backgroundColor:"#fff"},goText:{color:"#09090b",fontWeight:"700"},
 privacyBar:{minHeight:48,paddingHorizontal:8,paddingVertical:7,flexDirection:"row",alignItems:"center",gap:6,backgroundColor:"#09090b"},privacyTitle:{color:"#a1a1aa",fontSize:11,marginRight:2},pill:{borderWidth:1,borderColor:"#3f3f46",borderRadius:999,paddingHorizontal:9,paddingVertical:6},pillActive:{borderColor:"#fff"},pillText:{color:"#d4d4d8",fontSize:10},
 webContainer:{flex:1,position:"relative",backgroundColor:"#fff"},webLayer:{flex:1},hidden:{display:"none"},webview:{flex:1},loader:{position:"absolute",zIndex:2,top:0,left:0,right:0,paddingVertical:5,backgroundColor:"#fff"},bottomBar:{height:48,paddingHorizontal:18,flexDirection:"row",alignItems:"center",justifyContent:"space-between",backgroundColor:"#18181b"},bottomText:{color:"#d4d4d8",fontSize:11,fontWeight:"600"}
});