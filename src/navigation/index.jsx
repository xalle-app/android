import { NavigationContainer, DefaultTheme, DarkTheme, createNavigationContainerRef } from "@react-navigation/native";

export const navigationRef = createNavigationContainerRef();
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, Text, StyleSheet, StatusBar, Platform } from "react-native";
import Feather from "@expo/vector-icons/Feather";

import { useAuthStore } from "../store/auth.js";
import { useUnreadStore } from "../store/unread.js";
import { useTheme } from "../store/theme.js";
import AuthScreen           from "../screens/AuthScreen.jsx";
import ForgotPasswordScreen from "../screens/ForgotPasswordScreen.jsx";
import FeedScreen           from "../screens/FeedScreen.jsx";
import MessagesScreen       from "../screens/MessagesScreen.jsx";
import ChatScreen           from "../screens/ChatScreen.jsx";
import NotificationsScreen  from "../screens/NotificationsScreen.jsx";
import ProfileScreen        from "../screens/ProfileScreen.jsx";
import PostDetailScreen     from "../screens/PostDetailScreen.jsx";
import ComposeScreen        from "../screens/ComposeScreen.jsx";
import UserProfileScreen    from "../screens/UserProfileScreen.jsx";
import SettingsScreen       from "../screens/SettingsScreen.jsx";
import SearchScreen          from "../screens/SearchScreen.jsx";
import FollowListScreen     from "../screens/FollowListScreen.jsx";
import GroupChatScreen      from "../screens/GroupChatScreen.jsx";
import GroupSettingsScreen  from "../screens/GroupSettingsScreen.jsx";
import BookmarksScreen        from "../screens/BookmarksScreen.jsx";
import VoiceCallScreen        from "../screens/VoiceCallScreen.jsx";
import MemorableDatesScreen   from "../screens/MemorableDatesScreen.jsx";
import PlannerScreen          from "../screens/PlannerScreen.jsx";
import ScheduledPostsScreen   from "../screens/ScheduledPostsScreen.jsx";
import MusicScreen             from "../screens/MusicScreen.jsx";
import XallePlusScreen         from "../screens/XallePlusScreen.jsx";
import OpenCollabsScreen       from "../screens/OpenCollabsScreen.jsx";
import DmBanner             from "../components/DmBanner.jsx";
import IncomingCallWidget   from "../components/IncomingCallWidget.jsx";
import GlobalPlayerBar      from "../components/GlobalPlayerBar.jsx";

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();

const TAB_ICONS = {
  Feed:          "home",
  Messages:      "message-circle",
  Notifications: "bell",
  Profile:       "user",
};

function TabIcon({ name, focused }) {
  const c          = useTheme();
  const msgCount   = useUnreadStore(s => s.messages);
  const notifCount = useUnreadStore(s => s.notifications);
  const badge = name === "Messages" ? msgCount : name === "Notifications" ? notifCount : 0;

  return (
    <View style={[tabSt.iconWrap, focused && { backgroundColor: c.ACCENT }]}>
      <Feather
        name={TAB_ICONS[name] || "circle"}
        size={20}
        color={focused ? "#fff" : c.INK_SOFT}
      />
      {badge > 0 && (
        <View style={[tabSt.badge, focused && tabSt.badgeFocused]}>
          <Text style={tabSt.badgeText}>{badge > 99 ? "99+" : String(badge)}</Text>
        </View>
      )}
    </View>
  );
}

function MainTabs() {
  const c = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused }) => <TabIcon name={route.name} focused={focused} />,
        tabBarShowLabel: false,
        tabBarStyle: {
          backgroundColor: c.SURFACE,
          borderTopColor: c.LINE,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: 62,
          paddingBottom: Platform.OS === "ios" ? 0 : 6,
          paddingTop: 6,
          elevation: 12,
          shadowColor: "#000",
          shadowOpacity: c.DARK ? 0.3 : 0.08,
          shadowRadius: 16,
          shadowOffset: { width: 0, height: -4 },
        },
      })}
    >
      <Tab.Screen name="Feed"          component={FeedScreen} />
      <Tab.Screen name="Messages"      component={MessagesScreen} />
      <Tab.Screen name="Notifications" component={NotificationsScreen} />
      <Tab.Screen name="Profile"       component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const token = useAuthStore(s => s.token);
  const c = useTheme();

  const navTheme = {
    ...(c.DARK ? DarkTheme : DefaultTheme),
    colors: {
      ...(c.DARK ? DarkTheme.colors : DefaultTheme.colors),
      background: c.BG,
      card: c.SURFACE,
      text: c.INK,
      border: c.LINE,
      primary: c.ACCENT,
    },
  };

  return (
    <NavigationContainer ref={navigationRef} theme={navTheme}>
      <StatusBar
        barStyle={c.DARK ? "light-content" : "dark-content"}
        backgroundColor={c.SURFACE}
      />
      <DmBanner />
      <IncomingCallWidget />
      <GlobalPlayerBar />
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: c.SURFACE },
          headerTintColor: c.ACCENT,
          headerTitleStyle: { color: c.INK, fontWeight: "700" },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.BG },
          animation: "ios_from_right",
        }}
      >
        {!token ? (
          <>
            <Stack.Screen name="Auth"           component={AuthScreen}           options={{ headerShown: false }} />
            <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ headerShown: false }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main"        component={MainTabs}          options={{ headerShown: false }} />
            <Stack.Screen name="PostDetail"  component={PostDetailScreen}  options={{ title: "Пост" }} />
            <Stack.Screen name="ChatDetail"  component={ChatScreen}        options={{ headerShown: false }} />
            <Stack.Screen name="Compose"     component={ComposeScreen}     options={{ headerShown: false }} />
            <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Settings"    component={SettingsScreen}    options={{ headerShown: false }} />
            <Stack.Screen name="Search"      component={SearchScreen}      options={{ headerShown: false }} />
            <Stack.Screen name="FollowList"  component={FollowListScreen}  options={{ headerShown: false }} />
            <Stack.Screen name="GroupChat"     component={GroupChatScreen}     options={{ headerShown: false }} />
            <Stack.Screen name="GroupSettings" component={GroupSettingsScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Bookmarks"       component={BookmarksScreen}       options={{ headerShown: false }} />
            <Stack.Screen name="VoiceCall"       component={VoiceCallScreen}       options={{ headerShown: false, presentation: "fullScreenModal" }} />
            <Stack.Screen name="MemorableDates"    component={MemorableDatesScreen}    options={{ headerShown: false }} />
            <Stack.Screen name="Planner"           component={PlannerScreen}           options={{ headerShown: false }} />
            <Stack.Screen name="ScheduledPosts"    component={ScheduledPostsScreen}    options={{ headerShown: false }} />
            <Stack.Screen name="Music"             component={MusicScreen}             options={{ headerShown: false }} />
            <Stack.Screen name="XallePlus"        component={XallePlusScreen}        options={{ headerShown: false }} />
            <Stack.Screen name="OpenCollabs"      component={OpenCollabsScreen}      options={{ headerShown: false }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const tabSt = StyleSheet.create({
  iconWrap:     { width: 46, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  badge:        { position: "absolute", top: 1, right: 2, minWidth: 17, height: 17, borderRadius: 9, backgroundColor: "#e05a5a", alignItems: "center", justifyContent: "center", paddingHorizontal: 4, borderWidth: 2, borderColor: "#fff" },
  badgeFocused: { borderColor: "transparent" },
  badgeText:    { color: "#fff", fontSize: 9, fontWeight: "800", lineHeight: 13 },
});
