import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import React from 'react';
import { Platform, StyleSheet } from 'react-native';

const COLORS = {
    primary: '#00C2FF',
    inactive: '#94A3B8',
    background: '#FFFFFF',
    border: '#F1F5F9',
};

export default function DriverTabsLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: COLORS.primary,
                tabBarInactiveTintColor: COLORS.inactive,
                tabBarStyle: styles.tabBar,
                tabBarLabelStyle: styles.tabBarLabel,
            }}
        >
            {/* 1. OMAT AJOT */}
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Omat ajot',
                    tabBarIcon: ({ color, size }) => (
                        <Feather name="truck" size={size || 22} color={color} />
                    ),
                }}
            />

            {/* 2. ETSI */}
            <Tabs.Screen
                name="search"
                options={{
                    title: 'Etsi',
                    tabBarIcon: ({ color, size }) => (
                        <Feather name="search" size={size || 22} color={color} />
                    ),
                }}
            />

            {/* 3. PROFIILI */}
            <Tabs.Screen
                name="profile"
                options={{
                    title: 'Profiili',
                    tabBarIcon: ({ color, size }) => (
                        <Feather name="user" size={size || 22} color={color} />
                    ),
                }}
            />

            {/* KESKUSTELUT (Piilotettu alareunasta, avataan profiilista) */}
            <Tabs.Screen
                name="conversations"
                options={{
                    href: null,
                }}
            />

            {/* TOIMIALUE (Piilotettu alareunasta, avataan profiilista) */}
            <Tabs.Screen
                name="operating-area"
                options={{
                    href: null,
                }}
            />

            {/* AJONEUVO (Piilotettu alareunasta, avataan profiilista) */}
            <Tabs.Screen
                name="vehicle"
                options={{
                    href: null,
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        backgroundColor: COLORS.background,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        height: Platform.OS === 'ios' ? 88 : 68,
        paddingBottom: Platform.OS === 'ios' ? 30 : 10,
        paddingTop: 8,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
    },
    tabBarLabel: {
        fontSize: 12,
        fontWeight: '700',
        marginTop: 2,
    },
});
