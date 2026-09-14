import { Stack } from 'expo-router';
import React from 'react';

export default function AdminLayout() {
    return (
        <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="dispatch" />
            <Stack.Screen name="management" />
            <Stack.Screen name="app-manager" />
        </Stack>
    );
}
