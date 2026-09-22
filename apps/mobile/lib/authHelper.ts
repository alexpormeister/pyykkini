import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

/**
 * Hakee käyttäjän roolin tietokannasta.
 * Palauttaa 'driver' vain jos user_roles -taulussa on role = 'driver'.
 * Muussa tapauksessa palauttaa 'customer'.
 */
export async function getUserRole(userId: string): Promise<'driver' | 'customer'> {
    if (!userId) return 'customer';
    try {
        const queryPromise = supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', userId)
            .maybeSingle();

        const timeoutPromise = new Promise<{ data: any; error: any }>((resolve) =>
            setTimeout(() => resolve({ data: null, error: { message: 'timeout' } }), 1000)
        );

        const { data, error } = await Promise.race([queryPromise, timeoutPromise]);

        if (error || !data || !data.role) {
            return 'customer';
        }

        return data.role === 'driver' ? 'driver' : 'customer';
    } catch {
        return 'customer';
    }
}

/**
 * Luotettava uloskirjautuminen:
 * 1. Poistaa paikalliset auth-avaimet
 * 2. Kutsuu Supabase signOut
 * 3. Ohjaa suoraan kirjautumissivulle
 */
export async function performLogout(router?: any) {
    try {
        const allKeys = await AsyncStorage.getAllKeys();
        const authKeys = allKeys.filter(k => k.toLowerCase().includes('supabase') || k.toLowerCase().includes('auth'));
        if (authKeys.length > 0) {
            await AsyncStorage.multiRemove(authKeys);
        }
    } catch {}

    supabase.auth.signOut().catch(() => {});

    if (router) {
        router.replace('/auth/login' as any);
    }
}
