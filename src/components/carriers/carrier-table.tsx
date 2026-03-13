"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDeleteCarrier } from "@/hooks/use-carriers";
import type { Carrier } from "@/lib/db/schema";

interface CarrierTableProps {
  carriers: Carrier[];
}

export function CarrierTable({ carriers }: CarrierTableProps) {
  const router = useRouter();
  const deleteCarrier = useDeleteCarrier();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Slug</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {carriers.map((carrier) => (
          <TableRow key={carrier.id}>
            <TableCell className="font-medium">{carrier.name}</TableCell>
            <TableCell className="text-muted-foreground">{carrier.slug}</TableCell>
            <TableCell>
              <Badge variant={carrier.isActive ? "default" : "secondary"}>
                {carrier.isActive ? "Active" : "Inactive"}
              </Badge>
            </TableCell>
            <TableCell className="text-right space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/admin/carriers/${carrier.id}`)}
              >
                Edit
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={deleteCarrier.isPending}
                onClick={() => deleteCarrier.mutate(carrier.id)}
              >
                Delete
              </Button>
            </TableCell>
          </TableRow>
        ))}
        {carriers.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
              No carriers yet. Add your first carrier.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
