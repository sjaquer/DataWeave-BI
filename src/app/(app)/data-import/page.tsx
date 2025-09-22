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
                <span className="sr-only">Back</span>
            </Link>
        </Button>
        <div>
            <h1 className="text-3xl font-bold tracking-tight">Data Import</h1>
            <p className="text-muted-foreground">
            Import data from Excel files or connect your Google Sheets.
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
                <CardTitle>Import from Excel</CardTitle>
                <CardDescription>Upload a .xlsx or .csv file.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex w-full max-w-sm items-center space-x-2">
              <Input type="file" accept=".xlsx, .csv" />
              <Button type="submit">Upload</Button>
            </div>
             <p className="text-xs text-muted-foreground">
              Supports automatic refresh for live dashboards upon re-upload.
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
                <CardTitle>Connect Google Sheets</CardTitle>
                <CardDescription>Sync data directly from your spreadsheets.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
             <Button>Connect to Google Sheets</Button>
             <p className="text-xs text-muted-foreground">
              Allow DataWeave BI to access your Google Sheets. Data can be refreshed automatically.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
