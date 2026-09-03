import Link from "next/link";
import { PublicPageHeader } from "@/components/public/PublicPageHeader";
import { BLOG } from "@/lib/content/public";

export default function BlogPage() {
  return (
    <section>
      <PublicPageHeader title="Blog" description={BLOG.heading} />
      <div className="space-y-4">
        {BLOG.posts.map((post) => (
          <article key={post.slug} className="rounded-lg border bg-card p-6">
            <p className="text-xs text-muted-foreground">{post.date}</p>
            <h2 className="mt-1 text-lg font-semibold">
              <Link href={`/blog/${post.slug}`} className="text-primary hover:underline">
                {post.title}
              </Link>
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{post.excerpt}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
