"use client";

import { use, useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ArrowLeft, Star } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateReview,
  useInstallApp,
  useInstalledApps,
  usePublicReviews,
  usePublishedApp,
  useUninstallApp,
} from "@/hooks/use-marketplace";
import { friendlyErrorMessage } from "@/lib/api/api-error";
import { formatDate } from "@/lib/format";

const reviewSchema = z.object({
  rating: z.coerce.number().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});
type ReviewFormValues = z.infer<typeof reviewSchema>;

function formatPrice(priceCents: number | null): string {
  if (priceCents === null) return "";
  return priceCents === 0 ? "Free" : `$${(priceCents / 100).toFixed(2)}`;
}

export default function MarketplaceAppDetailPage({
  params,
}: {
  params: Promise<{ appId: string }>;
}) {
  const { appId } = use(params);
  const { data: app, isLoading } = usePublishedApp(appId);
  const { data: reviews } = usePublicReviews(appId);
  const { data: installs } = useInstalledApps();
  const installApp = useInstallApp();
  const uninstallApp = useUninstallApp();
  const createReview = useCreateReview();
  const [submittedReview, setSubmittedReview] = useState(false);

  const existingInstall = installs?.find((install) => install.appId === appId && install.status === "ACTIVE");

  const form = useForm<ReviewFormValues>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { rating: 5, comment: "" },
  });

  async function onInstall() {
    try {
      const result = await installApp.mutateAsync({
        appId,
        successUrl: window.location.href,
        cancelUrl: window.location.href,
      });
      if (result.checkoutUrl) {
        window.location.href = result.checkoutUrl;
        return;
      }
      toast.success(`Installed "${app?.name}"`);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function onUninstall() {
    if (!existingInstall) return;
    try {
      await uninstallApp.mutateAsync(existingInstall.id);
      toast.success(`Uninstalled "${app?.name}"`);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  async function onSubmitReview(values: ReviewFormValues) {
    try {
      await createReview.mutateAsync({ appId, rating: values.rating, comment: values.comment });
      toast.success("Thanks for the review!");
      setSubmittedReview(true);
    } catch (error) {
      toast.error(friendlyErrorMessage(error));
    }
  }

  if (isLoading || !app) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="h-40 animate-pulse rounded-card bg-secondary/60" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <Link
        href="/marketplace"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Marketplace
      </Link>

      <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 text-lg font-semibold text-primary">
            {app.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{app.name}</h1>
              <Badge variant="secondary">{app.category}</Badge>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Star className="h-3.5 w-3.5 fill-primary text-primary" />
              {app.reviewCount > 0
                ? `${app.averageRating.toFixed(1)} (${app.reviewCount} review${app.reviewCount === 1 ? "" : "s"})`
                : "No reviews yet"}
              {app.latestVersion && <span>&middot; v{app.latestVersion}</span>}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <span className="text-lg font-semibold text-foreground">{formatPrice(app.priceCents)}</span>
          {existingInstall ? (
            <Button variant="secondary" onClick={onUninstall} isLoading={uninstallApp.isPending}>
              Uninstall
            </Button>
          ) : (
            <Button onClick={onInstall} isLoading={installApp.isPending}>
              Install
            </Button>
          )}
        </div>
      </div>

      <Card className="mt-8 p-6">
        <h2 className="text-base font-semibold text-foreground">About this app</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {app.description ?? "This developer hasn't added a description yet."}
        </p>
      </Card>

      <div className="mt-8">
        <h2 className="text-base font-semibold text-foreground">Reviews</h2>

        {existingInstall && !submittedReview && (
          <Card className="mt-4 p-6">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmitReview)} className="flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="rating"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your rating</FormLabel>
                      <FormControl>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4, 5].map((value) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => field.onChange(value)}
                              className="p-0.5"
                              aria-label={`${value} star${value === 1 ? "" : "s"}`}
                            >
                              <Star
                                className={
                                  value <= field.value
                                    ? "h-6 w-6 fill-primary text-primary"
                                    : "h-6 w-6 text-muted-foreground"
                                }
                              />
                            </button>
                          ))}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="comment"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Comment (optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="What did you think?" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="self-start" isLoading={createReview.isPending}>
                  Submit review
                </Button>
              </form>
            </Form>
          </Card>
        )}

        <div className="mt-4 flex flex-col gap-3">
          {reviews?.length === 0 && (
            <EmptyState
              icon={Star}
              title="No reviews yet"
              description="Be the first to review this app after installing it."
            />
          )}
          {reviews?.map((review) => (
            <Card key={review.id} className="p-5">
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <Star
                      key={value}
                      className={
                        value <= review.rating
                          ? "h-3.5 w-3.5 fill-primary text-primary"
                          : "h-3.5 w-3.5 text-muted-foreground"
                      }
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">{formatDate(review.createdAt)}</span>
              </div>
              {review.comment && (
                <p className="mt-2 text-sm text-muted-foreground">{review.comment}</p>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
