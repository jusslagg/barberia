export type Role = 'admin' | 'barbero';
export type UserDoc = { role: Role; displayName: string; email: string; };
export type Client = { id: string; fullName: string; fullName_lower?: string; phone?: string; mainBarberId: string; notes?: string; createdAt: any; };
export type Cut = { id: string; clientId: string; barberId: string; photos: string[]; style?: string; notes?: string; createdAt: any; };
