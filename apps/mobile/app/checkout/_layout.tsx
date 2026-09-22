import { Stack } from 'expo-router';
import React from 'react';

export default function CheckoutLayout() {
    return (
        <Stack
            screenOptions={{
                headerShown: false,
                gestureEnabled: true,
                animation: 'slide_from_right',
            }}
        >
            <Stack.Screen name="index" />
            <Stack.Screen name="terms/terms" options={{ presentation: 'modal' }} />
        </Stack>
    );
}
