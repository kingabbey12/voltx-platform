"use client";

import { useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { MoreHorizontal, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useContacts, useCreateContact, useDeleteContact } from "@/hooks/use-sales";
import { contactSchema, type ContactFormValues } from "@/lib/validations/crm";
import { friendlyErrorMessage } from "@/lib/api/api-error";

export default function ContactsPage() {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data, isLoading } = useContacts({ search: search || undefined, limit: 50 });
  const createContact = useCreateContact();
  const deleteContact = useDeleteContact();

  const form = useForm<ContactFormValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: { firstName: "", lastName: "", email: "", jobTitle: "" },
  });

  async function onSubmit(values: ContactFormValues) {
    try {
      await createContact.mutateAsync({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email || undefined,
        jobTitle: values.jobTitle || undefined,
      });
      toast.success("Contact created");
      setDialogOpen(false);
      form.reset();
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteContact.mutateAsync(id);
      toast.success("Contact deleted");
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <Input
          placeholder="Search contacts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4" />
          Add contact
        </Button>
      </div>

      <div className="mt-4 rounded-xl border border-border">
        {isLoading && (
          <div className="flex flex-col gap-2 p-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 animate-pulse rounded-lg bg-secondary/60" />
            ))}
          </div>
        )}

        {!isLoading && data?.items.length === 0 && (
          <EmptyState
            icon={Users}
            title="No contacts yet"
            description="Add people from your companies to start tracking relationships."
            action={
              <Button size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4" />
                Add contact
              </Button>
            }
          />
        )}

        {!isLoading && data && data.items.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Title</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium">
                    <Link href={`/crm/contacts/${contact.id}`} className="hover:text-primary">
                      {contact.firstName} {contact.lastName}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{contact.email ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{contact.jobTitle ?? "—"}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="More options">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => handleDelete(contact.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add contact</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <FormControl>
                        <Input autoFocus {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last name</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email (optional)</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="jobTitle"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job title (optional)</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" isLoading={createContact.isPending}>
                  Add contact
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
