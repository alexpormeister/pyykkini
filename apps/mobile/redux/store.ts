// /redux/store.ts

import { configureStore } from '@reduxjs/toolkit';
import cartReducer from './cartSlice';
import profileReducer from './profileSlice'; // <-- LISÄTTY

export const store = configureStore({
    reducer: {
        cart: cartReducer,
        profile: profileReducer, // <-- LISÄTTY
    },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;