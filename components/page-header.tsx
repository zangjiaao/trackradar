import { Heading } from "@astryxdesign/core/Heading";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";

export function PageHeader({ title, description }: { title: string; description: string }) {
  return (
    <VStack gap={1}>
      <Heading level={1}>{title}</Heading>
      <Text type="supporting" as="p">
        {description}
      </Text>
    </VStack>
  );
}
