
"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart2, Briefcase, Calendar, Home, Inbox, Layers, MapPin, Settings, ShoppingCart, Users, FolderKanban, PanelLeft, LogOut, TruckIcon } from 'lucide-react';
import { useEffect } from 'react';

import {
  Sidebar,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarContent,
  SidebarTrigger,
  SidebarProvider,
  SidebarInset,
  useSidebar,
} from '@/components/ui/sidebar';
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

// Definir qué elementos del menú son accesibles por cada rol
const menuItems = [
  { 
    path: '/dashboard', 
    icon: Home, 
    label: 'Dashboard', 
    roles: ['gerente', 'encargado', 'callcenter', 'marketing'] // Todos
  },
  { 
    path: '/dashboard/shipments', 
    icon: TruckIcon, 
    label: 'Envíos', 
    roles: ['gerente', 'encargado'] // Logística
  },
  { 
    path: '/dashboard/performance', 
    icon: Users, 
    label: 'Rendimiento', 
    roles: ['gerente'] // Solo gerente
  },
  { 
    path: '/dashboard/meta-campaigns', 
    icon: Briefcase, 
    label: 'Campañas Meta', 
    roles: ['gerente', 'marketing'] // Marketing
  },
  { 
    path: '/dashboard/provinces', 
    icon: MapPin, 
    label: 'Provincias', 
    roles: ['gerente', 'encargado', 'callcenter'] // Logística y clientes
  },
  { 
    path: '/dashboard/daily', 
    icon: Calendar, 
    label: 'Análisis Diario', 
    roles: ['gerente', 'marketing'] // Gerente y marketing
  },
  { 
    path: '/dashboard/inventory', 
    icon: FolderKanban, 
    label: 'Análisis Inventario', 
    roles: ['gerente', 'encargado'] // Logística
  },
  { 
    path: '/dashboard/inventory-status', 
    icon: Inbox, 
    label: 'Estado Inventario', 
    roles: ['gerente', 'encargado', 'marketing'] // Logística y productos
  },
  { 
    path: '/dashboard/returns', 
    icon: Layers, 
    label: 'Análisis Mensual', 
    roles: ['gerente'] // Solo gerente
  },
];

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { isMobile, setOpenMobile, toggleSidebar, state } = useSidebar();
  const { user, userProfile, loading, signOut } = useAuth();

  // Proteger las rutas - redirigir a login si no está autenticado
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  // Mostrar loading mientras se verifica la autenticación
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

  // Si no hay usuario, no renderizar nada (se redirigirá)
  if (!user || !userProfile) {
    return null;
  }

  // Filtrar elementos del menú basados en el rol del usuario
  const filteredMenuItems = menuItems.filter(item => {
    return item.roles.includes(userProfile.role);
  });

  return (
    <>
      <Sidebar>
        <SidebarContent>
          <SidebarHeader>
              <div className={cn("flex items-center gap-2", state === 'collapsed' && 'justify-center')}>
                  <Logo className="size-7 text-primary" />
                   <span className={cn("text-xl font-semibold", state === 'collapsed' && 'hidden')}>DataWeave</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 md:flex hidden"
                onClick={toggleSidebar}
              >
                <PanelLeft />
                <span className="sr-only">Toggle Sidebar</span>
              </Button>
          </SidebarHeader>
          <SidebarMenu>
            {filteredMenuItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                    <Link href={item.path} onClick={handleLinkClick}>
                        <SidebarMenuButton
                            isActive={pathname === item.path}
                            icon={item.icon}
                            tooltip={item.label}
                        >
                            {item.label}
                        </SidebarMenuButton>
                    </Link>
                </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className={cn("w-full justify-start group-data-[collapsible=icon]:justify-center gap-2 px-2", state === 'collapsed' && 'justify-center')}>
                <Avatar className="size-7">
                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userProfile.email}`} alt={userProfile.displayName} />
                  <AvatarFallback>{userProfile.email?.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className={cn("flex flex-col items-start text-left flex-1 min-w-0", state === 'collapsed' && 'hidden')}>
                  <span className="text-sm font-medium truncate w-full">{userProfile.displayName}</span>
                  <span className="text-xs text-muted-foreground capitalize">{userProfile.role}</span>
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium">{userProfile.displayName}</p>
                  <p className="text-xs text-muted-foreground">{userProfile.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">Rol: {userProfile.role}</p>
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
      </Sidebar>
      <SidebarInset>
        <header className="flex h-12 items-center justify-between border-b bg-background/50 px-4 backdrop-blur-sm md:hidden">
            <div className="flex items-center gap-2">
                <Logo className="size-6 text-primary" />
                <span className="text-lg font-semibold">DataWeave</span>
            </div>
            <SidebarTrigger />
        </header>
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppLayoutContent>{children}</AppLayoutContent>
    </SidebarProvider>
  );
}
