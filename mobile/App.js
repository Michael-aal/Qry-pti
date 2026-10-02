import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  BackHandler,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WebView } from "react-native-webview";

const HOME_URL = "https://www.google.com";
const API_URL = "http://localhost:5000";

function normalizeUrl(value) {
  const input = value.trim();
  if (!input) return HOME_URL;

  try {
    return new URL(input).href;
  } catch {
    return `https://www.google.com/search?q=${encodeURIComponent(input)}`;
  }
}

export default function App() {
  const webview = useRef(null);
  const [url, setUrl] = useState(HOME_URL);
  const [address, setAddress] = useState(HOME_URL);
  const [loading, setLoading] = useState(false);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [privacy, setPrivacy] = useState({
    blockTrackers: true,
    blockThirdPartyCookies: true,
    fingerprintProtection: true,
  });

  useEffect(() => {
    AsyncStorage.getItem("qrypti_privacy").then((saved) => {
      if (saved) setPrivacy(JSON.parse(saved));
    });
  }, []);

  useEffect(() => {
    const onBack = () => {
      if (canGoBack) {
        webview.current?.goBack();
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => subscription.remove();
  }, [canGoBack]);

  const open = (value) => {
    const next = normalizeUrl(value);
    setAddress(next);
    setUrl(next);
  };

  const togglePrivacy = async (key) => {
    const next = { ...privacy, [key]: !privacy[key] };
    setPrivacy(next);
    await AsyncStorage.setItem("qrypti_privacy", JSON.stringify(next));
  };

  const addHistory = async (pageUrl) => {
    const raw = await AsyncStorage.getItem("qrypti_history");
    const history = raw ? JSON.parse(raw) : [];
    const next = [
      { url: pageUrl, at: Date.now() },
      ...history.filter((item) => item.url !== pageUrl),
    ].slice(0, 100);
    await AsyncStorage.setItem("qrypti_history", JSON.stringify(next));
  };

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#09090b" />

      <View style={styles.header}>
        <Text style={styles.brand}>QRY-PTI</Text>
        <Text style={styles.secure}>PRIVATE BROWSER</Text>
      </View>

      <View style={styles.addressRow}>
        <TouchableOpacity
          style={styles.navButton}
          disabled={!canGoBack}
          onPress={() => webview.current?.goBack()}
        >
          <Text style={[styles.navText, !canGoBack && styles.disabled]}>‹</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.navButton}
          disabled={!canGoForward}
          onPress={() => webview.current?.goForward()}
        >
          <Text style={[styles.navText, !canGoForward && styles.disabled]}>›</Text>
        </TouchableOpacity>

        <TextInput
          value={address}
          onChangeText={setAddress}
          onSubmitEditing={() => open(address)}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="Search or enter address"
          placeholderTextColor="#71717a"
          style={styles.address}
        />

        <TouchableOpacity style={styles.goButton} onPress={() => open(address)}>
          <Text style={styles.goText}>Go</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.privacyBar}>
        <Text style={styles.privacyTitle}>Privacy</Text>
        {[
          ["blockTrackers", "Trackers"],
          ["blockThirdPartyCookies", "3rd-party cookies"],
          ["fingerprintProtection", "Fingerprint"],
        ].map(([key, label]) => (
          <TouchableOpacity
            key={key}
            style={[styles.pill, privacy[key] && styles.pillActive]}
            onPress={() => togglePrivacy(key)}
          >
            <Text style={styles.pillText}>{privacy[key] ? "ON " : "OFF "}{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.webContainer}>
        {loading && (
          <View style={styles.loader}>
            <ActivityIndicator />
          </View>
        )}
        <WebView
          ref={webview}
          source={{ uri: url }}
          onLoadStart={() => setLoading(true)}
          onLoadEnd={() => setLoading(false)}
          onNavigationStateChange={(state) => {
            setAddress(state.url);
            setCanGoBack(state.canGoBack);
            setCanGoForward(state.canGoForward);
            addHistory(state.url);
          }}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled={privacy.blockThirdPartyCookies ? false : true}
          sharedCookiesEnabled={false}
          allowsBackForwardNavigationGestures
          startInLoadingState
          setSupportMultipleWindows={false}
          style={styles.webview}
        />
      </View>

      <View style={styles.bottomBar}>
        <TouchableOpacity onPress={() => open(HOME_URL)}>
          <Text style={styles.bottomText}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => webview.current?.reload()}>
          <Text style={styles.bottomText}>Reload</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => {
          AsyncStorage.getItem("qrypti_history").then((value) => {
            const count = value ? JSON.parse(value).length : 0;
            alert(`QRY-PTI history: ${count} saved pages`);
          });
        }}>
          <Text style={styles.bottomText}>History</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#09090b" },
  header: {
    height: 48,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brand: { color: "#fff", fontSize: 18, fontWeight: "800" },
  secure: { color: "#71717a", fontSize: 10, letterSpacing: 1.2 },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 8,
    gap: 6,
    backgroundColor: "#18181b",
  },
  navButton: {
    width: 36,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#27272a",
  },
  navText: { color: "#fff", fontSize: 26 },
  disabled: { color: "#52525b" },
  address: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    paddingHorizontal: 12,
    color: "#fff",
    backgroundColor: "#27272a",
  },
  goButton: {
    height: 38,
    paddingHorizontal: 13,
    borderRadius: 10,
    justifyContent: "center",
    backgroundColor: "#fff",
  },
  goText: { color: "#09090b", fontWeight: "700" },
  privacyBar: {
    minHeight: 48,
    paddingHorizontal: 8,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#09090b",
  },
  privacyTitle: { color: "#a1a1aa", fontSize: 11, marginRight: 2 },
  pill: {
    borderWidth: 1,
    borderColor: "#3f3f46",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  pillActive: { borderColor: "#fff" },
  pillText: { color: "#d4d4d8", fontSize: 10 },
  webContainer: { flex: 1, position: "relative", backgroundColor: "#fff" },
  webview: { flex: 1 },
  loader: {
    position: "absolute",
    zIndex: 2,
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 5,
    backgroundColor: "#fff",
  },
  bottomBar: {
    height: 48,
    paddingHorizontal: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#18181b",
  },
  bottomText: { color: "#d4d4d8", fontSize: 12, fontWeight: "600" },
});
