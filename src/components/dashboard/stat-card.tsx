import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface StatCardProps {
  title:        string;
  value:        string | number | null | undefined;
  description?: string;
  error?:       boolean;
}

export function StatCard({ title, value, description, error }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {error ? (
            <span className="text-destructive text-sm">Erreur</span>
          ) : value == null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            value
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}
