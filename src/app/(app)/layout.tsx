
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart2, Briefcase, Calendar, Home, Inbox, Layers, MapPin, Settings, ShoppingCart, Users, FolderKanban, LogOut, TruckIcon, Menu, X, Eye, EyeOff, PanelLeft } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Logo } from '@/components/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SidebarProvider, Sidebar, SidebarHeader, SidebarContent, SidebarFooter, SidebarTrigger } from '@/components/ui/sidebar';

const menuItems = [
    { path: '/dashboard', icon: Home, label: 'Dashboard', roles: ['gerente', 'encargado', 'callcenter', 'marketing'] },
    { path: '/dashboard/shipments', icon: TruckIcon, label: 'Envíos', roles: ['gerente', 'encargado'] },
    { path: '/dashboard/performance', icon: Users, label: 'Rendimiento', roles: ['gerente'] },
    { path: '/dashboard/meta-campaigns', icon: Briefcase, label: 'Campañas Meta', roles: ['gerente', 'marketing'] },
    { path: '/dashboard/provinces', icon: MapPin, label: 'Provincias', roles: ['gerente', 'encargado', 'callcenter'] },
    { path: '/dashboard/daily', icon: Calendar, label: 'Análisis Diario', roles: ['gerente', 'marketing'] },
    { path: '/dashboard/inventory', icon: FolderKanban, label: 'Análisis Inventario', roles: ['gerente', 'encargado'] },
    { path: '/dashboard/inventory-status', icon: Inbox, label: 'Estado Inventario', roles: ['gerente', 'encargado', 'marketing'] },
    { path: '/dashboard/returns', icon: Layers, label: 'Análisis Mensual', roles: ['gerente'] },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, userProfile, loading, signOut } = useAuth();
  
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  if (loading || !user || !userProfile) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
        <div className="flex flex-col items-center gap-4">
          <Logo className="size-12 text-primary animate-pulse" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  const filteredMenuItems = menuItems.filter(item => item.roles.includes(userProfile.role));

  const sidebarContent = (
    <>
      <SidebarHeader>
        <Link href="/dashboard" className="flex items-center gap-3 font-semibold group-data-[collapsible=icon]:justify-center">
          <Logo className="h-7 w-7 text-primary" />
          <span className="text-xl group-data-[collapsible=icon]:hidden">DataWeave</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <nav className="flex-1 space-y-2 overflow-y-auto">
            {filteredMenuItems.map((item) => {
            const isActive = pathname === item.path;
            return (
                <Link
                key={item.path}
                href={item.path}
                className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-muted group-data-[collapsible=icon]:justify-center',
                    isActive && 'bg-primary/10 text-primary font-medium'
                )}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="group-data-[collapsible=icon]:hidden">{item.label}</span>
                </Link>
            );
            })}
        </nav>
      </SidebarContent>

      <SidebarFooter>
         <DropdownMenu>
            <DropdownMenuTrigger asChild>
               <Button variant="ghost" className="w-full justify-start gap-3 px-2 py-2 h-auto group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:size-10">
                 <Avatar className="size-9">
                   <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile.email}`} alt={userProfile.displayName} />
                   <AvatarFallback>{userProfile.email?.charAt(0).toUpperCase()}</AvatarFallback>
                 </Avatar>
                 <div className="flex flex-col items-start text-left flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                   <span className="text-sm font-medium truncate w-full">{userProfile.displayName}</span>
                   <span className="text-xs text-muted-foreground capitalize">{userProfile.role}</span>
                 </div>
               </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
               <DropdownMenuLabel className="font-normal">
                 <div className="flex flex-col space-y-1">
                   <p className="text-sm font-medium leading-none">{userProfile.displayName}</p>
                   <p className="text-xs leading-none text-muted-foreground">{userProfile.email}</p>
                 </div>
               </DropdownMenuLabel>
               <DropdownMenuSeparator />
               <DropdownMenuItem onClick={handleSignOut}>
                 <LogOut className="mr-2 h-4 w-4" />
                 <span>Cerrar Sesión</span>
               </DropdownMenuItem>
            </DropdownMenuContent>
         </DropdownMenu>
      </SidebarFooter>
    </>
  );

  return (
    <SidebarProvider>
        <Sidebar>
            {sidebarContent}
        </Sidebar>
        <main>
          {children}
        </main>
    </SidebarProvider>
  );
}
