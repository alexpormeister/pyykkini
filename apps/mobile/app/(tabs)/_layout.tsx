import { Tabs, usePathname, useRouter } from 'expo-router';
import React from 'react';
import BottomNavBar from "../../components/BottomNavBar";

export default function TabLayout() {
  const router = useRouter();
  const pathname = usePathname();

  // Käsitellään välilehden vaihto
  const handleTabChange = (tabId: string) => {
    if (tabId === 'home') {
      router.push('/');
    } else if (tabId === 'orders') {
      router.push('/washes');
    } else if (tabId === 'profile') {
      router.push('/profile');
    }
  };

  // Määritetään mikä ikoni on aktiivisena navigaatiopalkissa
  const getActiveTab = () => {
    // Lisätty tarkistus myös uudelle orders-polulle
    if (pathname === '/washes' || pathname === '/general/orders') {
      return 'orders';
    }
    if (pathname === '/profile') {
      return 'profile';
    }
    return 'home';
  };

  return (
    <Tabs
      tabBar={() => (
        <BottomNavBar
          activeTab={getActiveTab()}
          onTabChange={handleTabChange}
        />
      )}
    >
      {/* Varmista että name vastaa tiedostonimeä (esim. washes.tsx) */}
      <Tabs.Screen name="index" options={{ headerShown: false }} />
      <Tabs.Screen name="washes" options={{ headerShown: false }} />
      <Tabs.Screen name="profile" options={{ headerShown: false }} />
    </Tabs>
  );
}