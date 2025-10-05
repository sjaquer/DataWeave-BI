// src/app/(app)/layout.tsx
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart2, Briefcase, Calendar, Home, Inbox, Layers, MapPin, Settings, ShoppingCart, Users, FolderKanban } from 'lucide-react';

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
} from '@/components/ui/sidebar';
import { Logo } from '@/components/icons';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

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


export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarContent>
          <SidebarHeader>
              <div className="flex items-center gap-2">
                  <Logo className="size-7 text-primary" />
                  <span className="text-xl font-semibold">DataWeave</span>
              </div>
          </SidebarHeader>
          <SidebarMenu>
            {menuItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                    <Link href={item.path}>
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
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-sidebar-foreground/80">
              Usuario
            </span>
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
    </SidebarProvider>
  );
}
