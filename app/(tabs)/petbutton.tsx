import { useRouter } from 'expo-router';
import { collection, getDocs, getFirestore, orderBy, query, where } from 'firebase/firestore';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ImageBackground, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import BackToCommunityHubRow from '../../components/BackToCommunityHubRow';
import PetCard from '../../components/PetCard';
import { app } from '../../firebase';
import { Pet } from '../../types/Pet';

export default function PetHubScreen() {
  const router = useRouter();
  const [lostPets, setLostPets] = useState<Pet[]>([]);
  const [foundPets, setFoundPets] = useState<Pet[]>([]);
  const [adoptionPets, setAdoptionPets] = useState<Pet[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchAllPets();
  }, []);

  const fetchAllPets = async () => {
    try {
      setLoading(true);
      const db = getFirestore(app);
      const petsRef = collection(db, 'pets');

      // Fetch Lost Pets
      const lostQuery = query(
        petsRef,
        where('postType', '==', 'lost'),
        orderBy('createdAt', 'desc')
      );
      const lostSnapshot = await getDocs(lostQuery);
      const lostPetsData = lostSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Pet));

      // Fetch Found Pets
      const foundQuery = query(
        petsRef,
        where('postType', '==', 'found'),
        orderBy('createdAt', 'desc')
      );
      const foundSnapshot = await getDocs(foundQuery);
      const foundPetsData = foundSnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      } as Pet));

      // Fetch Adoption Pets
      const adoptionQuery = query(
        petsRef,
        where('postType', '==', 'adoption'),
        orderBy('createdAt', 'desc')
      );
      const adoptionSnapshot = await getDocs(adoptionQuery);
      import PetHubScreen from '../pet-hub';

      export default function PetButtonRoute() {
        return <PetHubScreen />;
      }
      setLostPets(lostPetsData);
