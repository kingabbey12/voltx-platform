"use client";

import Link from "next/link";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { CheckCircle2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useResetPassword } from "@/hooks/use-auth";
import { resetPasswordSchema, type ResetPasswordFormValues } from "@/lib/validations/auth";
import { friendlyErrorMessage } from "@/lib/api/api-error";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const resetPassword = useResetPassword();
  const [showPassword, setShowPassword] = useState(false);
  const [done, setDone] = useState(false);

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  async function onSubmit(values: ResetPasswordFormValues) {
    if (!token) {
      toast.error("This reset link is missing its token. Request a new one.");
      return;
    }
    try {
      await resetPassword.mutateAsync({ token, password: values.password });
      setDone(true);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  if (!token) {
    return (
      <Card className="border-border/70 shadow-lg">
        <CardContent className="flex flex-col items-center gap-3 pt-6 text-center">
          <h2 className="text-lg font-semibold">Invalid reset link</h2>
          <p className="text-sm text-muted-foreground">
            This link is missing its token. Request a new password reset email.
          </p>
          <Button asChild className="mt-2 w-full">
            <Link href="/forgot-password">Request new link</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (done) {
    return (
      <Card className="border-border/70 shadow-lg">
        <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
            <CheckCircle2 className="h-7 w-7 text-success" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Password reset</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Your password has been updated. Sign in with your new password.
            </p>
          </div>
          <Button className="mt-2 w-full" onClick={() => router.replace("/login")}>
            Continue to sign in
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/70 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">Set a new password</CardTitle>
        <CardDescription>Choose a strong password for your Voltx account.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New password</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        className="pr-10"
                        autoFocus
                        {...field}
                      />
                    </FormControl>
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    At least 8 characters, with upper, lower, and a number.
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm new password</FormLabel>
                  <FormControl>
                    <Input
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="mt-2 w-full" isLoading={resetPassword.isPending}>
              Reset password
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}
