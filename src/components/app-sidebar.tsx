'use client';

import {
  BarChart3,
  Database,
  LayoutDashboard,
  Settings,
  Target,
  Upload,
  Users,
  Warehouse,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Logo } from '@/components/icons';
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from '@/components/ui/sidebar';

const menuItems = [
  {
    href: '/dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
  },
  {
    href: '/sales',
    label: 'Sales Analysis',
    icon: BarChart3,
  },
  {
    href: '/inventory',
    label: 'Inventory',
    icon: Warehouse,
  },
  {
    href: '/kpis',
    label: 'KPIs',
    icon: Target,
  },
  {
    href: '/demographics',
    label: 'Demographics',
    icon: Users,
  },
  {
    href: '/database-schema',
    label: 'DB Schema AI',
    icon: Database,
  },
  {
    href: '/data-import',
    label: 'Data Import',
    icon: Upload,
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar
      variant="sidebar"
      collapsible="icon"
      className="border-r"
    >
      <SidebarHeader className="flex items-center gap-2">
        <Logo className="size-6 text-primary" />
        <span className="text-lg font-semibold text-primary">DataWeave</span>
      </SidebarHeader>

      <SidebarContent className="p-2">
        <SidebarMenu>
          {menuItems.map((item) => (
            <SidebarMenuItem key={item.label}>
              <SidebarMenuButton
                asChild
                isActive={pathname === item.href}
                tooltip={item.label}
              >
                <Link href={item.href}>
                  <item.icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Settings">
              <Settings />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
