"use client";

import {
  Settings,
} from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Logo } from "@/components/icons";
import { Button } from "@/components/ui/button";


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
        </div>
      </header>
      <main className="flex flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8">
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Bienvenido, John Doe</h1>
            <p className="text-muted-foreground">Todo tu negocio, en un solo lugar.</p>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {/* Aquí añadiremos las nuevas tarjetas y componentes */}
        </div>
      </main>
    </div>
  );
}
