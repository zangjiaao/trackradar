import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";

export function DbFallback({ message }: { message: string }) {
  return (
    <Card>
      <VStack gap={2}>
        <Heading level={2}>本地数据库还没准备好</Heading>
        <Text type="supporting" as="p">
          {message}
        </Text>
        <Text type="supporting" as="p">
          在项目根目录执行 <Text type="code">npm run db:migrate</Text>，然后刷新此页。
        </Text>
      </VStack>
    </Card>
  );
}
