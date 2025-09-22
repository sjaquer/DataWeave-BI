"use client";

import {
  ArrowRight,
  BarChart3,
  Database,
  LayoutDashboard,
  Settings,
  Target,
  Upload,
  Users,
  Warehouse,
  FileText
} from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Logo } from "@/components/icons";

const menuItems = [
  {
    href: "/sales",
    label: "Sales Analysis",
    icon: BarChart3,
    description: "Deep dive into sales performance",
    className: "md:col-span-2",
  },
  {
    href: "/inventory",
    label: "Inventory",
    icon: Warehouse,
    description: "Monitor and analyze stock levels",
    className: "",
  },
   {
    href: "/kpis",
    label: "KPIs",
    icon: Target,
    description: "Track key performance indicators",
    className: "",
  },
  {
    href: "/demographics",
    label: "Demographics",
    icon: Users,
    description: "Understand your customer base",
    className: "",
  },
  {
    href: "/database-schema",
    label: "DB Schema AI",
    icon: Database,
    description: "Generate schemas with AI",
    className: "md:col-span-2",
  },
  {
    href: "/data-import",
    label: "Data Import",
    icon: Upload,
    description: "Import data from various sources",
    className: "",
  },
];

export default function Dashboard() {
  return (
    <div className="flex min-h-screen w-full flex-col">
       <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
        <div className="flex items-center gap-2">
            <Logo className="size-7 text-primary" />
            <span className="text-xl font-semibold text-primary">DataWeave</span>
        </div>
        <div className="flex items-center gap-2">
            <Link href="#">
                <Button variant="ghost" size="icon">
                    <Settings className="h-5 w-5" />
                </Button>
            </Link>
             <UserNav />
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Welcome, John Doe</h1>
            <p className="text-muted-foreground">Here's a quick overview of your business.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
            {menuItems.map((item) => (
            <Card
                key={item.label}
                className={`group relative flex transform flex-col justify-between overflow-hidden rounded-xl border-2 border-transparent bg-card text-card-foreground shadow-lg transition-all hover:-translate-y-1 hover:border-primary/50 hover:shadow-primary/20 ${item.className}`}
            >
                 <Link href={item.href} className="absolute inset-0 z-10" />
                <CardHeader>
                    <div className="mb-4 flex items-center justify-between">
                         <item.icon className="h-8 w-8 text-primary" />
                          <ArrowRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
                    </div>
                    <CardTitle className="text-xl">{item.label}</CardTitle>
                    <CardDescription>{item.description}</CardDescription>
                </CardHeader>
            </Card>
            ))}
        </div>
      </main>
    </div>
  );
}

// Re-add UserNav and Button to be used on this page
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { CreditCard, LogOut, User } from 'lucide-react';

function UserNav() {
  const userAvatar = PlaceHolderImages.find((img) => img.id === 'user-avatar');

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          <Avatar className="h-9 w-9">
            <AvatarImage
              src={userAvatar?.imageUrl}
              alt="User Avatar"
              data-ai-hint={userAvatar?.imageHint}
            />
            <AvatarFallback>JD</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">John Doe</p>
            <p className="text-xs leading-none text-muted-foreground">
              john.doe@example.com
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem>
            <User className="mr-2 h-4 w-4" />
            <span>Profile</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <CreditCard className="mr-2 h-4 w-4" />
            <span>Billing</span>
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Settings className="mr-2 h-4 w-4" />
            <span>Settings</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Log out</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
