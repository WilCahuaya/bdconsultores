import Link from "next/link";
import { notFound } from "next/navigation";
import { BLOG, BLOG_CONTENT } from "@/lib/content/public";

interface BlogPostPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return BLOG.posts.map((post) => ({ slug: post.slug }));
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const { slug } = await params;
  const post = BLOG_CONTENT[slug];

  if (!post) notFound();

  return (
    <article>
      <Link href="/blog" className="text-sm text-primary hover:underline">
        ← Volver al blog
      </Link>
      <p className="mt-4 text-xs text-muted-foreground">{post.date}</p>
      <h1 className="mt-1 text-3xl font-bold text-primary">{post.title}</h1>
      <div className="mt-6 space-y-4">
        {post.content.map((paragraph) => (
          <p key={paragraph.slice(0, 40)} className="text-muted-foreground">
            {paragraph}
          </p>
        ))}
      </div>
    </article>
  );
}
