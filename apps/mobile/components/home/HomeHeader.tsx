import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';

const COLORS = {
    primary: '#005D97',
    white: 'white',
};

const BasketImage = require("../../assets/images/pointy-basket-3d.png");

interface HomeHeaderProps {
    onStartPress: () => void;
    // LISÄTTY: Vastaanottaa dynaamisen tyylin (esim. paddingTop)
    style?: ViewStyle;
}

const HomeHeader: React.FC<HomeHeaderProps> = ({ onStartPress, style }) => {
    return (
        <LinearGradient
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            colors={['#5CD1FF', '#00C2FF', '#0099FF']}
            // LISÄTTY: Yhdistetään styles.header ja ulkoinen style
            style={[styles.header, style]}
        >
            {/* 🌊 KORISTEELLISET AALTO- JA VIRTAUSVIIVAT 🌊 */}
            <View style={styles.lineContainer} pointerEvents="none">
                <View style={styles.arcOuter} />
                <View style={styles.arcMiddle} />
                <View style={styles.arcInner} />
                <View style={styles.diagonalLine1} />
                <View style={styles.diagonalLine2} />
            </View>

            <View style={styles.headerContent}>
                <Text style={styles.title}>Pyykkiä tulossa?</Text>
                <Text style={styles.subtitle}>Valitse pestävät ja noutoaika, me hoidamme loput.</Text>

                <TouchableOpacity
                    style={styles.startButton}
                    onPress={onStartPress}
                >
                    <Text style={styles.startButtonText}>Aloita Pesu</Text>
                </TouchableOpacity>
            </View>

            <Image
                source={BasketImage}
                style={styles.basketImage}
                resizeMode="contain"
            />
        </LinearGradient>
    );
}

export default HomeHeader;

const styles = StyleSheet.create({
    header: {
        // HUOM: paddingTop on nyt 0, jotta se on täysin riippuvainen ulkoisesta style-propista.
        // Poistettu vanha kova koodaus paddingTop: 60,
        padding: 25,
        paddingTop: 0,
        paddingBottom: 135,
        position: 'relative',
        overflow: 'hidden',
    },
    lineContainer: {
        ...StyleSheet.absoluteFill,
        overflow: 'hidden',
    },
    arcOuter: {
        position: 'absolute',
        top: -90,
        right: -70,
        width: 340,
        height: 340,
        borderRadius: 170,
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.22)',
    },
    arcMiddle: {
        position: 'absolute',
        top: -50,
        right: -30,
        width: 260,
        height: 260,
        borderRadius: 130,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.18)',
    },
    arcInner: {
        position: 'absolute',
        top: -10,
        right: 10,
        width: 180,
        height: 180,
        borderRadius: 90,
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        borderStyle: 'dashed',
    },
    diagonalLine1: {
        position: 'absolute',
        bottom: 25,
        left: -40,
        width: 300,
        height: 1.5,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        transform: [{ rotate: '-22deg' }],
    },
    diagonalLine2: {
        position: 'absolute',
        bottom: 55,
        left: -20,
        width: 240,
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        transform: [{ rotate: '-22deg' }],
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: COLORS.white,
        marginBottom: 10,
        textShadowColor: 'rgba(0, 40, 95, 0.35)',
        textShadowOffset: { width: 0, height: 1.5 },
        textShadowRadius: 4,
    },
    subtitle: {
        fontSize: 16,
        color: COLORS.white,
        marginBottom: 25,
        maxWidth: '70%',
        textShadowColor: 'rgba(0, 40, 95, 0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    headerContent: {
        // Sisältöä nostetaan ylös, jotta se mahtuu tyhjään tilaan
        top: 55,
    },
    startButton: {
        backgroundColor: COLORS.white,
        paddingVertical: 12,
        paddingHorizontal: 30,
        borderRadius: 30,
        alignSelf: 'flex-start',
    },
    startButtonText: {
        color: "black",
        fontSize: 18,
        fontWeight: 'bold',
    },
    basketImage: {
        position: 'absolute',
        bottom: -10,
        right: 15,
        width: 150,
        height: 150,
        zIndex: 10,
    },
});