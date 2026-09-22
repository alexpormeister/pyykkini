import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StripeProvider } from '@stripe/stripe-react-native';
import { Session } from '@supabase/supabase-js';
import { Stack, useRouter, useSegments } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { LogBox, View } from 'react-native';
import { Provider } from 'react-redux';
import { getUserRole } from '../lib/authHelper';
import { supabase } from '../lib/supabase';
import { store } from '../redux/store';
import AnimatedSplashScreen from '../components/AnimatedSplashScreen';

// Estetään natiivin splash screenin ennenaikainen sulkeminen
SplashScreen.preventAutoHideAsync().catch(() => {});

// Hiljennetään kehitysaikaiset ei-kriittiset ilmoitukset
LogBox.ignoreLogs([
    '[Reanimated] Reduced motion setting is enabled on this device.',
    '[Reanimated] Reduced motion setting is enabled',
    'Reduced motion setting is enabled',
    'Invalid Refresh Token',
    'AuthApiError: Invalid Refresh Token',
    'Found screens with the same name nested inside one another',
    '[Layout children]: Too many screens defined',
    'is extraneous',
]);

const STRIPE_PUBLISHABLE_KEY = "pk_test_51Ru0JGRwjWBeEBIGYcLA5aY63XU9Lt2GeB9y2lG4Bq3g2LVAbmp0To6JGkVTzi0V7OwuNsStpYkqUyIIFp33zGll00rU8YWjX0";

// Sisäinen komponentti, joka hoitaa navigoinnin ja suojauksen
function RootLayoutNav() {
    const [session, setSession] = useState<Session | null>(null);
    const [userRole, setUserRole] = useState<'driver' | 'customer'>('customer');
    const [loading, setLoading] = useState(true);
    const [isSplashAnimationDone, setIsSplashAnimationDone] = useState(false);
    const router = useRouter();
    const segments = useSegments();

    useEffect(() => {
        let isMounted = true;

        // Haetaan istunto käynnistyksessä
        supabase.auth.getSession().then(async ({ data: { session }, error }) => {
            if (!isMounted) return;
            if (error || !session) {
                setSession(null);
                setUserRole('customer');
                setLoading(false);
                return;
            }

            setSession(session);
            if (session.user) {
                const role = await getUserRole(session.user.id);
                if (isMounted) setUserRole(role);
            }
            if (isMounted) setLoading(false);
        }).catch(() => {
            if (isMounted) {
                setSession(null);
                setUserRole('customer');
                setLoading(false);
            }
        });

        // Kuunnellaan kirjautumistilan muutoksia
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
            if (!isMounted) return;
            setSession(newSession);

            if (newSession?.user) {
                const role = await getUserRole(newSession.user.id);
                if (isMounted) setUserRole(role);
            } else {
                setUserRole('customer');
            }
        });

        return () => {
            isMounted = false;
            subscription?.unsubscribe();
        };
    }, []);

    useEffect(() => {
        if (loading || !isSplashAnimationDone) return;

        const inAuthRoute = segments[0] === 'auth';
        const inDriverRoute = segments[0] === 'driver';

        if (!session) {
            // Ei istuntoa -> aina kirjautumissivulle
            if (!inAuthRoute) {
                router.replace('/auth/login' as any);
            }
        } else {
            // Istunto on voimassa:
            if (userRole === 'driver') {
                // Kuljettaja ohjataan kuljettajanäkymään
                if (inAuthRoute || segments[0] === '(tabs)') {
                    router.replace('/driver' as any);
                }
            } else {
                // Asiakas ohjataan asiakaskauppaan
                if (inAuthRoute || inDriverRoute) {
                    router.replace('/');
                }
            }
        }
    }, [session, userRole, loading, segments, isSplashAnimationDone]);

    // 🔥 1. JOS SPLASH-ANIMAATIO ON KÄYNNISSÄ: NÄYTETÄÄN AINOASTAAN SE (EI STACKIA ALLA) 🔥
    if (!isSplashAnimationDone) {
        return (
            <AnimatedSplashScreen
                onAnimationComplete={() => {
                    setIsSplashAnimationDone(true);
                }}
            />
        );
    }

    // 🔥 2. KUN ANIMAATIO ON VALMIS: LISÄTÄÄN NORMAALI NAVIGOINTIPINO 🔥
    return (
        <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
            <StripeProvider
                publishableKey={STRIPE_PUBLISHABLE_KEY}
                merchantIdentifier="merchant.com.pesuni"
                urlScheme="pesuni"
            >
                <Stack
                    screenOptions={{
                        headerShown: false,
                        gestureEnabled: true,
                        fullScreenGestureEnabled: false,
                        animation: 'slide_from_right',
                    }}
                >
                    <Stack.Screen
                        name="(tabs)"
                        options={{
                            headerShown: false,
                            gestureEnabled: false,
                        }}
                    />
                    <Stack.Screen
                        name="driver"
                        options={{
                            headerShown: false,
                            gestureEnabled: false,
                        }}
                    />
                    <Stack.Screen
                        name="auth"
                        options={{
                            headerShown: false,
                            gestureEnabled: false,
                        }}
                    />
                    <Stack.Screen
                        name="general"
                        options={{
                            headerShown: false,
                            gestureEnabled: true,
                            fullScreenGestureEnabled: false,
                        }}
                    />
                    <Stack.Screen
                        name="checkout"
                        options={{
                            headerShown: false,
                            gestureEnabled: true,
                            fullScreenGestureEnabled: false,
                        }}
                    />
                </Stack>
            </StripeProvider>
        </View>
    );
}

// Pääkomponentti, joka tarjoaa Redux-storen koko sovellukselle
export default function RootLayout() {
    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Provider store={store}>
                <RootLayoutNav />
            </Provider>
        </GestureHandlerRootView>
    );
}