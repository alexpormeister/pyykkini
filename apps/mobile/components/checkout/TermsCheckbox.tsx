import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

const COLORS = {
    white: '#FFFFFF',
    darkText: '#0F172A',
    textGray: '#64748B',
    primary: '#00C2FF',
    cardBorder: '#F1F5F9',
    error: '#EF4444',
};

interface TermsCheckboxProps {
    onToggle: (accepted: boolean) => void;
    isAccepted: boolean;
    style?: ViewStyle;
}

const TermsCheckbox: React.FC<TermsCheckboxProps> = ({ onToggle, isAccepted, style }) => {
    const router = useRouter();

    const handleToggle = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onToggle(!isAccepted);
    };

    const handleViewTerms = () => {
        router.push("/checkout/terms/terms");
    };

    return (
        <View style={[styles.card, style]}>
            <TouchableOpacity
                style={styles.checkboxRow}
                onPress={handleToggle}
                activeOpacity={0.8}
            >
                <View style={[styles.checkbox, isAccepted && styles.checkboxChecked]}>
                    {isAccepted && <Feather name="check" size={14} color={COLORS.white} />}
                </View>

                <View style={styles.textContainer}>
                    <Text style={styles.termsText}>
                        Hyväksyn Pesunin palveluehdot. Ymmärrän, että pyykkipussi noudetaan ovelta ja toimitetaan puhtaana valittuna aikana.
                    </Text>

                    {/* 🔥 ERILLISELLÄ RIVILLÄ: LUE EHDOT 🔥 */}
                    <TouchableOpacity
                        style={styles.linkButton}
                        onPress={handleViewTerms}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.linkText}>Lue käyttöehdot</Text>
                        <Feather name="external-link" size={12} color="#0284C7" style={{ marginLeft: 4 }} />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>

            {!isAccepted && (
                <Text style={styles.warningText}>* Hyväksy ehdot jatkaaksesi tilaukseen</Text>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: COLORS.white,
        borderRadius: 24,
        padding: 18,
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
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#CBD5E1',
        marginRight: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        marginTop: 2,
    },
    checkboxChecked: {
        backgroundColor: '#0284C7',
        borderColor: '#0284C7',
    },
    textContainer: {
        flex: 1,
    },
    termsText: {
        fontSize: 13,
        color: COLORS.darkText,
        lineHeight: 19,
        fontWeight: '500',
    },
    linkButton: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        marginTop: 6,
        paddingVertical: 2,
    },
    linkText: {
        color: '#0284C7',
        fontWeight: '700',
        fontSize: 13,
    },
    warningText: {
        fontSize: 11,
        color: COLORS.error,
        marginTop: 8,
        fontWeight: '700',
        marginLeft: 34,
    },
});

export default TermsCheckbox;