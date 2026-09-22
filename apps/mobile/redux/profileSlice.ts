// /redux/profileSlice.ts

import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { RootState } from './store';

// Rajapinta profiilitiedolle
export interface UserProfile {
    id: string;
    first_name: string | null | undefined;
    last_name: string | null | undefined;
    phone: string | null | undefined;
    email: string | null | undefined;
    address: string | null | undefined;
    address_coords?: { lat: number; lon: number } | undefined;
    points_balance?: number;
    birth_date?: string | null | undefined;
    age?: string | number | null | undefined;
    gender?: string | null | undefined;
    role?: string | null | undefined;
}

// Alkuperäinen tila
const initialState: UserProfile = {
    id: '',
    first_name: null,
    last_name: null,
    phone: null,
    email: null,
    address: null,
    address_coords: undefined,
    points_balance: 0,
    birth_date: null,
    age: null,
    gender: null,
    role: null,
};

export const profileSlice = createSlice({
    name: 'profile',
    initialState,
    reducers: {
        // Päivittää KAIKKI profiilin tiedot kerralla
        setProfile: (state, action: PayloadAction<UserProfile>) => {
            return action.payload;
        },
        // Päivittää vain tietyt kentät
        updateProfileFields: (state, action: PayloadAction<Partial<UserProfile>>) => {
            return { ...state, ...action.payload };
        },
        // Tyhjentää profiilitiedot uloskirjautuessa
        clearProfile: () => {
            return initialState;
        },
    },
});

export const { setProfile, updateProfileFields, clearProfile } = profileSlice.actions;

// Selector, jota käytetään tiedon lukemiseen mistä tahansa komponentista
export const selectUserProfile = (state: RootState) => state.profile;

export default profileSlice.reducer;