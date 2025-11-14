"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Logo } from '@/components/icons';

export default function Home() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        router.push('/dashboard');
      } else {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <Logo className="size-12 text-primary animate-pulse mx-auto mb-4" />
        <p className="text-muted-foreground">DataWeave BI — Hecho por sjaquer</p>
        <p className="text-sm text-muted-foreground mt-2">Accede a tu panel: inicia sesión o serás redirigido automáticamente.</p>
      </div>
    </div>
  );
}

