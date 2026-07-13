import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Reveal } from "@/components/motion/reveal";
import { Badge } from "@/components/ui/badge";
import { CtaSection } from "@/components/sections/cta-section";
import { blogPosts, getBlogPost } from "@/lib/blog";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return blogPosts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) {
    return { title: "Post not found" };
  }
  return {
    title: post.title,
    description: post.excerpt,
  };
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = getBlogPost(slug);

  if (!post) {
    notFound();
  }

  return (
    <>
      <article className="relative overflow-hidden py-20 sm:py-28">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 surface-grid opacity-[0.25] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_10%,transparent_75%)]"
        />
        <div className="container">
          <div className="mx-auto max-w-2xl">
            <Reveal>
              <Link
                href="/blog"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to blog
              </Link>
            </Reveal>

            <Reveal delay={0.05}>
              <div className="mt-8 flex items-center gap-3">
                <Badge variant="accent">{post.category}</Badge>
                <span className="text-xs text-muted-foreground">
                  {formatDate(post.date)} &middot; {post.readingMinutes} min read
                </span>
              </div>
            </Reveal>

            <Reveal delay={0.1}>
              <h1 className="text-balance mt-5 text-3xl font-semibold tracking-tight sm:text-5xl">
                {post.title}
              </h1>
            </Reveal>

            <Reveal delay={0.15}>
              <p className="mt-4 text-sm text-muted-foreground">By {post.author}</p>
            </Reveal>

            <Reveal delay={0.2}>
              <div className="mt-10 flex flex-col gap-6">
                {post.content.map((paragraph, i) => (
                  <p key={i} className="text-lg leading-relaxed text-foreground/90">
                    {paragraph}
                  </p>
                ))}
              </div>
            </Reveal>
          </div>
        </div>
      </article>

      <CtaSection />
    </>
  );
}
