import { Button, Text, Title } from "@mantine/core";
import { IconCloudDownload } from "@tabler/icons-react";
import { href, Link } from "react-router";
import type { Route } from "./+types/download";

export const handle = {
  title: "Download Daily Observations",
};
export async function loader({ context }: Route.LoaderArgs) {
  const s3List = await context.cloudflare.env.R2_BUCKET.list({
    prefix: "daily-observations/",
  });
  return {
    files: s3List.objects.map((object) => ({
      key: object.key.replace("daily-observations/", ""),
      size: (object.size / (1024 * 1024)).toFixed(2), // Convert bytes to MB and format to 2 decimal places
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
      <Title order={2}>Download all observations</Title>
      {loaderData.files.map((file) => (
        <Text key={file.key} my={"xs"}>
          {file.key} - {file.size}
          <sub>MB</sub>
          <Button
            component={Link}
            to={href("/download-observation/:file", {
              file: file.key.replace(/\.csv$/, ""),
            })}
            size={"compact-sm"}
            rightSection={<IconCloudDownload size={16} />}
            reloadDocument
            ml={"sm"}
            variant={"outline"}
          >
            Download
          </Button>
        </Text>
      ))}
    </>
  );
}
