import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Upload, Sheet, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function DataImportPage() {
  return (
    <div className="space-y-6">
       <div className="flex items-center gap-4">
        <Button asChild variant="outline" size="icon">
            <Link href="/dashboard">
                <ArrowLeft className="h-4 w-4"/>
                <span className="sr-only">Volver</span>
            </Link>
        </Button>
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Importar Datos</h1>
            <p className="text-muted-foreground">
            Importa datos desde archivos de Excel o conecta tus Hojas de Cálculo de Google.
            </p>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="bg-primary/10 p-3 rounded-md">
                <Upload className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle>Importar desde Excel</CardTitle>
                <CardDescription>Sube un archivo .xlsx o .csv.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex w-full max-w-sm items-center space-x-2">
              <Input type="file" accept=".xlsx, .csv" />
              <Button type="submit">Subir</Button>
            </div>
             <p className="text-xs text-muted-foreground">
              Soporta actualización automática para paneles en vivo al volver a subir.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
             <div className="flex items-center gap-4">
              <div className="bg-accent/10 p-3 rounded-md">
                <Sheet className="h-6 w-6 text-accent" />
              </div>
              <div>
                <CardTitle>Conectar Hojas de Cálculo de Google</CardTitle>
                <CardDescription>Sincroniza datos directamente desde tus hojas de cálculo.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
             <Button>Conectar a Hojas de Cálculo de Google</Button>
             <p className="text-xs text-muted-foreground">
              Permite que DataWeave BI acceda a tus Hojas de Cálculo de Google. Los datos pueden ser actualizados automáticamente.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
