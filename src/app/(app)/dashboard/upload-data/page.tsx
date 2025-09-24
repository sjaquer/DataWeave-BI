
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import DataUploader from "@/components/DataUploader";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UploadDataPage() {
    return (
        <div className="flex-1 space-y-6 p-4 md:p-8 pt-6">
             <div className="flex items-center justify-between space-y-2 mb-6">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Carga Manual de Datos</h2>
                    <p className="text-muted-foreground">
                        Sube aquí los archivos CSV para las tiendas no conectadas por webhooks.
                    </p>
                </div>
                <Link href="/dashboard" passHref>
                    <Button variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Volver al Dashboard
                    </Button>
                </Link>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Cargar Archivos CSV de Shopify</CardTitle>
                    <CardDescription>
                       Asegúrate de seguir las instrucciones para una carga de datos exitosa.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <DataUploader />
                </CardContent>
            </Card>
        </div>
    )
}
