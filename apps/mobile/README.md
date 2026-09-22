Pesuni

Pesuni on React Native / Expo -pohjainen mobiilisovellus pesulapalveluiden helppoon ja nopeaan tilaamiseen. Sovellus hyödyntää Supabasea backendinä (autentikaatio, tietokanta) ja Redux Toolkitia sovelluksen tilanhallintaan (esim. ostoskori).

Ominaisuudet

Käyttäjän autentikaatio: Turvallinen kirjautuminen, rekisteröityminen ja salasanan palautus (Supabase Auth).

Palveluiden selaus: Selaa tuotteita ja palveluita kategorioittain. Voit myös suodattaa näkymää löytääksesi juuri tarvitsemasi palvelun.

Ostoskori: Reduxilla toteutettu reaaliaikainen ostoskori. Lisää tuotteita, muuta määriä ja poista tuotteita helposti. Ostoskorin sisältö säilyy sovelluksen käytön ajan.

Profiili: Hallitse omia tietojasi. Voit tarkastella ja päivittää nimesi, sähköpostiosoitteesi, puhelinnumerosi ja osoitteesi.

Tilaushistoria: (Tulossa) Tarkastele aiempia tilauksiasi ja niiden tilaa.

Teknologiat

Frontend: React Native, Expo, Expo Router

Backend: Supabase (PostgreSQL, Auth)

Tilanhallinta: Redux Toolkit, React Redux

Tyylittely: StyleSheet (React Native), React Native Vector Icons (Feather, FontAwesome5)

Asennus ja käynnistys

Kloonaa repositorio:

git clone <REPO_URL>
cd pesuni

Asenna riippuvuudet:

npm install

Määritä ympäristömuuttujat:
Luo .env-tiedosto projektin juureen ja lisää sinne Supabase-projektisi tiedot:

EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key

Käynnistä sovellus:

npx expo start

Voit avata sovelluksen Expo Go -sovelluksella puhelimessasi skannaamalla QR-koodin, tai käyttää emulaattoria (Android Studio / Xcode).

Projektin rakenne

app/: Expo Routerin reitit (sivut ja navigaatio).

(tabs)/: Päänäkymät (Koti, Tilaukset, Profiili).

auth/: Kirjautumis- ja rekisteröitymissivut.

profile/: Profiiliin liittyvät alisivut (esim. henkilötiedot).

components/: Uudelleenkäytettävät UI-komponentit.

redux/: Redux store ja slicet (esim. cartSlice).

lib/: Apukirjastot ja konfiguraatiot (esim. supabase.ts).

assets/: Kuvat, fontit ja muut staattiset tiedostot.
