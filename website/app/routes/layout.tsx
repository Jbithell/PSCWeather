import { Container, Text, Title } from "@mantine/core";
import { Link, Outlet } from "react-router";
import { getTitleFromMatches } from "~/utils/getTitleFromMatches";
import type { Route } from "./+types/layout";
export function meta() {
  return [
    {
      title: `${getTitleFromMatches()} | Porthmadog Sailing Club Weather Station`,
    },
  ];
}
export default function Page({ actionData, loaderData }: Route.ComponentProps) {
  return (
    <Container mt={"lg"}>
      <Title order={1}>Porthmadog Sailing Club Weather Station</Title>
      <Outlet />
      <Text
        fw={300}
        mt={"lg"}
        size={"sm"}
        component={Link}
        to={"https://jbithell.com"}
        target="_blank"
      >
        &copy;2017-2025 James Bithell
      </Text>
    </Container>
  );
}
