import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Reveal, StaggerGroup, StaggerItem } from "@/components/motion/reveal";
import { SectionEyebrow } from "@/components/sections/stats-bar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { blogPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Product updates and engineering notes from the team building Voltx — how we designed multi-tenancy, the Extension Framework, Sales Copilot, and the v2.3 Developer Platform.",
};

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogPage() {
  return (
    <>
      <section className="relative overflow-hidden pb-16 pt-20 sm:pt-28">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 surface-grid opacity-[0.3] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_10%,transparent_75%)]"
        />
        <div className="container text-center">
          <Reveal>
            <SectionEyebrow>Blog</SectionEyebrow>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="text-balance mx-auto mt-6 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
              Product updates and engineering notes
            </h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="text-pretty mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
              How we build Voltx, why we made the calls we made, and what shipped along the way.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="container pb-24 sm:pb-32">
        <StaggerGroup className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {blogPosts.map((post) => (
            <StaggerItem key={post.slug}>
              <Link href={`/blog/${post.slug}`} className="group block h-full">
                <Card className="flex h-full flex-col p-7 transition-colors group-hover:border-primary/40">
                  <div className="flex items-center gap-3">
                    <Badge variant="accent">{post.category}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(post.date)} &middot; {post.readingMinutes} min read
                    </span>
                  </div>
                  <h2 className="mt-4 text-xl font-semibold tracking-tight text-foreground">
                    {post.title}
                  </h2>
                  <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">
                    {post.excerpt}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-primary">
                    Read more
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Card>
              </Link>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>
    </>
  );
}
