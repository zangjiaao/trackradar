export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6 flex max-w-3xl flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
    </div>
  );
}
