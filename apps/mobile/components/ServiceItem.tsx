import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity } from 'react-native';

interface ServiceItemProps {
    name: string;
    imagePath: any;
    backgroundColor: string;
    onPress: () => void;
}

const ServiceItem: React.FC<ServiceItemProps> = ({ name, imagePath, backgroundColor, onPress }) => {
    return (
        <TouchableOpacity onPress={onPress} style={[styles.container, { backgroundColor }]}>
            <Image source={imagePath} style={styles.image} />
            <Text style={styles.text}>{name}</Text>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        borderRadius: 15,
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
    },
    image: {
        width: '70%',
        height: '60%',
        resizeMode: 'contain',
        marginBottom: 8,
    },
    text: {
        fontWeight: 'bold',
        fontSize: 16,
        textAlign: 'center',
    },
});

export default ServiceItem;