
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart2, Briefcase, Calendar, Home, Inbox, Layers, MapPin, Settings, ShoppingCart, Users, FolderKanban, PanelLeft } from 'lucide-react';

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

const menuItems = [
  { path: '/dashboard', icon: Home, label: 'Dashboard' },
  { path: '/dashboard/performance', icon: Users, label: 'Rendimiento' },
  { path: '/dashboard/meta-campaigns', icon: Briefcase, label: 'Campañas Meta' },
  { path: '/dashboard/provinces', icon: MapPin, label: 'Provincias' },
  { path: '/dashboard/daily', icon: Calendar, label: 'Análisis Diario' },
  { path: '/dashboard/inventory', icon: FolderKanban, label: 'Análisis Inventario' },
  { path: '/dashboard/inventory-status', icon: Inbox, label: 'Estado Inventario' },
  { path: '/dashboard/returns', icon: Layers, label: 'Análisis Mensual' },
];

function AppLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile, toggleSidebar, state } = useSidebar();

  const handleLinkClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <>
      <Sidebar>
        <SidebarContent>
          <SidebarHeader className="justify-between">
              <div className="flex items-center gap-2">
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
            {menuItems.map((item) => (
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
          <div className="flex items-center gap-2">
            <Avatar className="size-7">
              <AvatarImage src="https://picsum.photos/seed/user-avatar/100/100" alt="User" />
              <AvatarFallback>N</AvatarFallback>
            </Avatar>
          </div>
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
