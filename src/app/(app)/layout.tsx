
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


// --- NEW RESPONSIVE LAYOUT ---

// 1. Navigation Menu Data (No changes needed here)
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

// 2. Main Layout Component
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, userProfile, loading, signOut } = useAuth();
  const [isMobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(true);

  // Auth protection (no changes needed)
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  // Close mobile menu on navigation
  useEffect(() => {
    if (isMobileMenuOpen) {
      setMobileMenuOpen(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const handleSignOut = async () => {
    await signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background z-50">
        <div className="flex flex-col items-center gap-4">
          <Logo className="size-12 text-primary animate-pulse" />
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!user || !userProfile) {
    return null; // Redirecting...
  }

  const filteredMenuItems = menuItems.filter(item => item.roles.includes(userProfile.role));

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Sidebar Header */}
      <SidebarHeader className="flex h-16 items-center border-b px-4 lg:px-6">
        <Link href="/dashboard" className="flex items-center gap-3 font-semibold">
          <Logo className="h-7 w-7 text-primary" />
          <span className="text-xl group-data-[collapsible=icon]:hidden">DataWeave</span>
        </Link>
        <div className="flex-1" />
        <SidebarTrigger className="hidden md:flex" />
      </SidebarHeader>

      {/* Navigation Menu */}
      <SidebarContent>
        <nav className="flex-1 space-y-2 overflow-y-auto px-2 py-4">
            {filteredMenuItems.map((item) => {
            const isActive = pathname === item.path;
            return (
                <Link
                key={item.path}
                href={item.path}
                className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary hover:bg-muted',
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

      {/* Sidebar Footer (User Profile) */}
      <SidebarFooter className="mt-auto border-t p-2">
         <DropdownMenu>
            <DropdownMenuTrigger asChild>
               <Button variant="ghost" className="w-full justify-start gap-3 px-2 py-2 h-auto">
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
    </div>
  );

  return (
    <SidebarProvider open={isSidebarOpen} onOpenChange={setSidebarOpen}>
        <div className="grid min-h-screen w-full">
            {/* --- Desktop Sidebar (Fixed) --- */}
            <Sidebar>
                {sidebarContent}
            </Sidebar>

            {/* --- Mobile View & Main Content --- */}
            <div className="flex flex-col">
                {/* Mobile Header */}
                <header className="flex h-14 items-center gap-4 border-b bg-background px-4 md:hidden">
                    <SidebarTrigger />
                    <div className='flex-1 text-center'>
                        <Logo className="inline-block h-7 w-7 text-primary" />
                    </div>
                    <div className='w-9'></div> {/* Spacer to balance the header */}
                </header>
                
                {/* Main Content */}
                <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-muted/40">
                    {children}
                </main>
            </div>
        </div>
    </SidebarProvider>
  );
}
