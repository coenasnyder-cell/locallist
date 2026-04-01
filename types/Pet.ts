// Pet schema for Firestore and app
export interface Pet {
  id: string;
  postType: 'lost' | 'found' | 'adoption';
  petName: string;
  petType: string;
  petBreed: string;
  petAge: string;
  petGender: 'male' | 'female' | 'unknown';
  petDescription: string;
  petSeenLocation: string;
  petAdoptionFee?: number; // For adoption posts
  petPhoto?: string; // Single image (legacy)
  petImages?: string[]; // Multiple images (new)
  userId: string;
  petStatus: 'lost' | 'found' | 'reunited' | 'adopted' | 'available';
  createdAt: any; // Firestore Timestamp
}
