import { Redirect } from 'expo-router';
import React from 'react';

export default function AdminIndex() {
    return <Redirect href="/admin/dispatch" />;
}
