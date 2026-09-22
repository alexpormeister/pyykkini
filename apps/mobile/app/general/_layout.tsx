import { Stack } from 'expo-router';
import React from 'react';

export default function GeneralLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                gestureEnabled: true,
                animation: 'slide_from_right',
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="chat" />
            <Stack.Screen name="chatscreen" />
            <Stack.Screen name="notifications" />
            <Stack.Screen name="orders" />
            <Stack.Screen name="personal-data" />
            <Stack.Screen name="privacy-policy" />
        </Stack>
    );
}
