interface PublicPageHeaderProps {
  title: string;
  description?: string;
}

export function PublicPageHeader({ title, description }: PublicPageHeaderProps) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-primary">{title}</h1>
      {description && <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p>}
    </div>
  );
}
