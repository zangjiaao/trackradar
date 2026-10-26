import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function DbFallback({ message }: { message: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>本地数据库还没准备好</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm leading-6 text-muted-foreground">
        <p>{message}</p>
        <p>
          在项目根目录执行 <code className="rounded bg-muted px-1.5 py-0.5">npm run db:migrate</code>，然后刷新此页。
        </p>
      </CardContent>
    </Card>
  );
}
