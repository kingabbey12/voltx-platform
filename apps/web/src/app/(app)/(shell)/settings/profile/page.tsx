"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuthStore } from "@/lib/stores/auth-store";
import { usersApi } from "@/lib/api/users";
import { friendlyErrorMessage } from "@/lib/api/api-error";

const profileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: z.string().trim().min(1, "Last name is required").max(100),
  jobTitle: z.string().trim().max(150).optional(),
});
type ProfileFormValues = z.infer<typeof profileSchema>;

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ""}${lastName[0] ?? ""}`.toUpperCase();
}

export default function ProfileSettingsPage() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    values: user
      ? { firstName: user.firstName, lastName: user.lastName, jobTitle: user.jobTitle ?? "" }
      : undefined,
  });

  const updateProfile = useMutation({
    mutationFn: usersApi.updateMe,
    onSuccess: (updated) => {
      if (user) setUser({ ...user, ...updated });
      toast.success("Profile updated");
    },
    onError: (error) => toast.error(friendlyErrorMessage(error)),
  });

  if (!user) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Your profile</CardTitle>
        <CardDescription>Update your personal information.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 flex items-center gap-3">
          <Avatar className="h-14 w-14">
            <AvatarImage src={user.avatarUrl ?? undefined} alt={user.firstName} />
            <AvatarFallback className="text-base">{initials(user.firstName, user.lastName)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">{user.email}</p>
            <p className="text-xs text-muted-foreground">
              {user.emailVerifiedAt ? "Verified" : "Not verified"}
            </p>
          </div>
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) => updateProfile.mutate(values))}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First name</FormLabel>
                    <FormControl>
                      <Input {...field} />
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
            <div>
              <Button type="submit" isLoading={updateProfile.isPending}>
                Save changes
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
