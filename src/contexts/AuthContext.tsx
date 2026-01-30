"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { DEMO_CREDENTIALS, DEMO_USER_PROFILE } from '@/lib/demo-data';

export type UserRole = 'gerente' | 'encargado' | 'callcenter' | 'marketing';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  displayName?: string;
  createdAt?: Date;
}

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isDemoMode: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, role: UserRole, displayName?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Verificar si hay una sesión demo activa al cargar
  useEffect(() => {
    const demoSession = typeof window !== 'undefined' ? localStorage.getItem('demoSession') : null;
    if (demoSession === 'active') {
      setIsDemoMode(true);
      setUserProfile(DEMO_USER_PROFILE);
      // Crear un usuario mock para el modo demo
      setUser({ uid: DEMO_USER_PROFILE.uid, email: DEMO_USER_PROFILE.email } as User);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Si estamos en modo demo, no escuchar cambios de auth de Firebase
    if (isDemoMode) return;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        // Cargar el perfil del usuario desde Firestore
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);
          
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserProfile({
              uid: user.uid,
              email: user.email || '',
              role: data.role || 'callcenter',
              displayName: data.displayName || (user.email ?? ''),
              createdAt: data.createdAt?.toDate(),
            });
          } else {
            // Si no existe el perfil, crear uno por defecto
            const defaultProfile: UserProfile = {
              uid: user.uid,
              email: user.email || '',
              role: 'callcenter',
              displayName: user.email ?? '',
            };
            
            await setDoc(userDocRef, {
              ...defaultProfile,
              createdAt: new Date(),
            });
            
            setUserProfile(defaultProfile);
          }
        } catch (error) {
          console.error('Error al cargar el perfil del usuario:', error);
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isDemoMode]);

  const signIn = async (email: string, password: string) => {
    // Verificar credenciales demo
    if (email === DEMO_CREDENTIALS.email && password === DEMO_CREDENTIALS.password) {
      console.log('[AUTH] Modo Demo activado');
      setIsDemoMode(true);
      setUserProfile(DEMO_USER_PROFILE);
      setUser({ uid: DEMO_USER_PROFILE.uid, email: DEMO_USER_PROFILE.email } as User);
      if (typeof window !== 'undefined') {
        localStorage.setItem('demoSession', 'active');
      }
      return;
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error('Error al iniciar sesión:', error);
      throw new Error(error.message || 'Error al iniciar sesión');
    }
  };

  const signUp = async (email: string, password: string, role: UserRole, displayName?: string) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Crear el perfil del usuario en Firestore
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        uid: user.uid,
        email: user.email,
        role: role,
        displayName: displayName || email,
        createdAt: new Date(),
      });
    } catch (error: any) {
      console.error('Error al registrar usuario:', error);
      throw new Error(error.message || 'Error al registrar usuario');
    }
  };

  const signOut = async () => {
    // Si estamos en modo demo, limpiar la sesión demo
    if (isDemoMode) {
      console.log('[AUTH] Cerrando sesión demo');
      setIsDemoMode(false);
      setUser(null);
      setUserProfile(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('demoSession');
      }
      return;
    }

    try {
      await firebaseSignOut(auth);
    } catch (error: any) {
      console.error('Error al cerrar sesión:', error);
      throw new Error(error.message || 'Error al cerrar sesión');
    }
  };

  const value: AuthContextType = {
    user,
    userProfile,
    loading,
    isDemoMode,
    signIn,
    signUp,
    signOut,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}
