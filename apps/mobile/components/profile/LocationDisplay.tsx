import { Feather, FontAwesome5 } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';

interface LocationDisplayProps {
    onLocationPress: () => void;
}

const LocationDisplay: React.FC<LocationDisplayProps> = ({ onLocationPress }) => {
    const [address, setAddress] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchAddress();
    }, []);

    const fetchAddress = async () => {
        try {
            setLoading(true);
            const { data: { session } } = await supabase.auth.getSession();
            const user = session?.user;

            if (user) {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('address')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (!error && data) {
                    setAddress(data.address);
                } else {
                    setAddress(null);
                }
            } else {
                setAddress(null);
            }
        } catch (error) {
            console.error('Error fetching address:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <TouchableOpacity
                onPress={onLocationPress}
                style={styles.locationButton}
            >
                <FontAwesome5 name="home" size={18} color="#333333" style={styles.icon} />

                {loading ? (
                    <ActivityIndicator size="small" color="#333333" style={{ marginRight: 4 }} />
                ) : (
                    <Text style={styles.locationText}>
                        {address || "Lisää osoite"}
                    </Text>
                )}

                <Feather name="chevron-down" size={20} color="#333333" />
            </TouchableOpacity>
        </View>
    );
};

export default LocationDisplay;

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 25,
        paddingVertical: 15,
    },
    locationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        backgroundColor: '#fff',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    icon: {
        marginRight: 10,
    },
    locationText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#333333',
        marginRight: 6,
        maxWidth: 200,
    },
});