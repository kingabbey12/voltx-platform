"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
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
import { useRequestPasswordReset } from "@/hooks/use-auth";
import { forgotPasswordSchema, type ForgotPasswordFormValues } from "@/lib/validations/auth";
import { friendlyErrorMessage } from "@/lib/api/api-error";

export default function ForgotPasswordPage() {
  const requestReset = useRequestPasswordReset();
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: ForgotPasswordFormValues) {
    try {
      await requestReset.mutateAsync(values.email);
      setSubmitted(true);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  if (submitted) {
    return (
      <Card className="border-border/70 shadow-lg">
        <CardContent className="flex flex-col items-center gap-4 pt-6 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-success/15">
            <CheckCircle2 className="h-7 w-7 text-success" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Check your email</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              If an account exists for that email, we&apos;ve sent a link to reset your password.
            </p>
          </div>
          <Button asChild variant="outline" className="mt-2 w-full">
            <Link href="/login">
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/70 shadow-lg">
      <CardHeader>
        <CardTitle className="text-xl">Reset your password</CardTitle>
        <CardDescription>
          Enter your email and we&apos;ll send you a link to reset your password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      placeholder="you@company.com"
                      autoFocus
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="mt-2 w-full" isLoading={requestReset.isPending}>
              Send reset link
            </Button>
          </form>
        </Form>
        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/login" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
