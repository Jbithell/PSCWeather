import type { Route } from "./+types/downloadCsv";

export async function loader({ context, params }: Route.LoaderArgs) {
  const fileName = params.file;
  if (!fileName || !/^[0-9-]+$/.test(fileName))
    return new Response("Invalid filename", { status: 400 });

  const fileStream = await context.cloudflare.env.R2_BUCKET.get(
    `daily-observations/${fileName}.csv`
  );
  if (!fileStream || fileStream === null)
    return new Response("File not found", { status: 404 });
  return new Response(fileStream.body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename=Porthmadog Sailing Club Weather Observations ${fileName}.csv`,
    },
  });
}
