import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View, ViewStyle } from 'react-native';

const COLORS = {
    white: '#FFFFFF',
    darkText: '#0F172A',
    textGray: '#64748B',
    cardBorder: '#F1F5F9',
    inputBg: '#F8FAFC',
    inputBorder: '#E2E8F0',
};

interface ExtraInstructionsProps {
    onChangeText: (text: string) => void;
    initialValue?: string;
    style?: ViewStyle;
}

const ExtraInstructions: React.FC<ExtraInstructionsProps> = ({ onChangeText, initialValue = '', style }) => {
    const [instructions, setInstructions] = useState(initialValue);

    const handleTextChange = (text: string) => {
        setInstructions(text);
        onChangeText(text);
    };

    return (
        <View style={[styles.card, style]}>
            <Text style={styles.title}>Lisäohjeet kuljettajalle</Text>
            <Text style={styles.subtitle}>
                Valinnainen (esim. ovikoodi, porras tai pesutoiveet)
            </Text>

            <TextInput
                style={styles.input}
                placeholder="Kirjoita ovikoodi, kerros tai muut lisäohjeet tähän..."
                placeholderTextColor="#94A3B8"
                value={instructions}
                onChangeText={handleTextChange}
                multiline={true}
                numberOfLines={3}
                textAlignVertical="top"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.white,
        borderRadius: 24,
        padding: 20,
        marginVertical: 8,
        marginHorizontal: 16,
        borderWidth: 1,
        borderColor: COLORS.cardBorder,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    title: {
        fontSize: 16,
        fontWeight: '800',
        color: COLORS.darkText,
        marginBottom: 2,
    },
    subtitle: {
        fontSize: 12,
        color: COLORS.textGray,
        marginBottom: 12,
    },
    input: {
        backgroundColor: COLORS.inputBg,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 16,
        fontSize: 14,
        color: COLORS.darkText,
        borderWidth: 1,
        borderColor: COLORS.inputBorder,
        minHeight: 80,
    },
});

export default ExtraInstructions;