import { createAsyncThunk } from '@reduxjs/toolkit';
import { supabase } from '../lib/supabase';
import { clearProfile, setProfile } from './profileSlice';

interface SupabaseProfileData {
    id: string;
    first_name: string | null | undefined;
    last_name: string | null | undefined;
    phone: string | null | undefined;
    email: string | null | undefined;
    address: string | null | undefined;
    points_balance?: number;
    birth_date?: string | null | undefined;
    age?: string | number | null | undefined;
    gender?: string | null | undefined;
    role?: string | null | undefined;
}

/**
 * Asynkroninen toiminto (Thunk) käyttäjän profiilin lataamiseen Supabasesta
 * ja sen asettamiseen Redux-tilaan.
 */
export const fetchUserProfile = createAsyncThunk(
    'profile/fetchUserProfile',
    async (arg, { dispatch, rejectWithValue }) => {
        try {
            // 1. Hae kirjautunut käyttäjä nopeasti välimuistista
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;

            if (!user) {
                // Jos käyttäjä ei ole kirjautunut, tyhjennetään profiili
                dispatch(clearProfile());
                return rejectWithValue('Käyttäjä ei ole kirjautunut sisään');
            }

            // 2. Hae profiili profiles-taulusta
            let { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();

            if (error) {
                console.warn('Profiilin hakuvaroitus:', error.message);
            }

            let profileData: SupabaseProfileData;

            if (!data) {
                profileData = {
                    id: user.id,
                    first_name: null,
                    last_name: null,
                    phone: null,
                    email: user.email || null,
                    address: null,
                    points_balance: 0,
                    age: null,
                    gender: null,
                };
            } else {
                profileData = {
                    ...data,
                    points_balance: data.points_balance || 0,
                } as SupabaseProfileData;
            }
            
            // 3. Aseta profiili Redux-tilaan
            dispatch(setProfile(profileData));

            return profileData;

        } catch (error: any) {
            console.error('Profiilin haku epäonnistui:', error);
            return rejectWithValue(error.message || 'Profiilin lataus epäonnistui');
        }
    }
);