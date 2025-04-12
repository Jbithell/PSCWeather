import { Text, Title } from "@mantine/core";
import type { Route } from "./+types/download";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Download" }];
}
export async function loader({ context }: Route.LoaderArgs) {
  const s3List = await context.cloudflare.env.R2_BUCKET.list({
    prefix: "daily-observations/",
  });
  return {
    files: s3List.objects.map((object) => ({
      key: object.key,
      size: object.size,
    })),
  };
}
export default function Page({
  loaderData,
}: Route.ComponentProps & {
  loaderData: { files: { key: string; size: number }[] };
}) {
  return (
    <>
      <Title>Files</Title>
      {loaderData.files.map((file) => (
        <Text key={file.key}>
          {file.key} - {file.size} bytes
          <a href={`${file.key}`}>Download</a>
        </Text>
      ))}
    </>
  );
}
